#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>
#include <TinyGPS++.h>

// ==========================================
// 1. WiFi Credentials
// ==========================================
const char* ssid = "Teoh";
const char* password = "Kailun2003";

// ==========================================
// 2. WebSocket Configuration
// ==========================================
const char* ws_host = "handled-pts-vary-hiv.trycloudflare.com";
const int ws_port = 443; 
const char* ws_url = "/ws";

WebSocketsClient webSocket;

// ==========================================
// 3. PIN DEFINITIONS (ESP32-S3 Standard)
// ==========================================
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     15
#define SIOD_GPIO_NUM     4
#define SIOC_GPIO_NUM     5
#define Y9_GPIO_NUM       16
#define Y8_GPIO_NUM       17
#define Y7_GPIO_NUM       18
#define Y6_GPIO_NUM       12
#define Y5_GPIO_NUM       10
#define Y4_GPIO_NUM       8
#define Y3_GPIO_NUM       9
#define Y2_GPIO_NUM       11
#define VSYNC_GPIO_NUM    6
#define HREF_GPIO_NUM     7
#define PCLK_GPIO_NUM     13

// ==========================================
// 4. AUDIO PIN DEFINITIONS
// ==========================================
#define I2S_BCLK       41
#define I2S_LRC        40
#define I2S_DOUT       42
#define MIC_IN_PIN     1

// ==========================================
// 5. GPS PIN DEFINITIONS
// ==========================================
#define GPS_RX_PIN 39
#define GPS_TX_PIN 38

TinyGPSPlus gps;
HardwareSerial gpsSerial(1); 
unsigned long last_gps_time = 0;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("SUCCESS: WebSocket Connected to Python Server!");
      break;
    case WStype_BIN:
      size_t bytes_written;
      i2s_write(I2S_NUM_0, payload, length, &bytes_written, pdMS_TO_TICKS(15));
      break;
  }
}

// Function to initialize the MAX98357 Speaker
void initSpeaker() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 22050,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("[INFO] MAX98357 Speaker Initialized.");
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  Serial.println("\n--- OUTDOOR EDGE DEVICE START ---");

  // Initialize Microphone Pin
  pinMode(MIC_IN_PIN, INPUT);
  Serial.println("[INFO] MAX4466 Microphone Ready.");

  // Initialize Speaker
  initSpeaker();

  // Initialize GPS Serial Communication
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[INFO] GY-NEO-6M GPS Initialized.");

  // Camera Config
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  
  // High speed AI settings
  config.xclk_freq_hz = 20000000;       
  config.frame_size = FRAMESIZE_VGA;   
  config.pixel_format = PIXFORMAT_JPEG; 
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 10;
  config.fb_count = 2;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed! 0x%x\n", err);
    return;
  }
  
  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
      s->set_vflip(s, 1);
      s->set_hmirror(s, 1);
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  webSocket.beginSSL(ws_host, ws_port, ws_url);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000); 
  webSocket.enableHeartbeat(15000, 3000, 2);
}

// ----------------------------------------------------
// THE FIREHOSE: Send autonomously at 15 FPS
// ----------------------------------------------------
unsigned long last_transmission = 0;
const int TARGET_FPS = 15; 
const int FRAME_DELAY = 1000 / TARGET_FPS; 

void loop() {
  webSocket.loop();

  unsigned long current_time = millis();
  
  // Read GPS Data constantly in the background
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Send Video Frames at 15 FPS
  if (current_time - last_transmission >= FRAME_DELAY) {
      camera_fb_t * fb = esp_camera_fb_get();
      if (fb) {
        webSocket.sendBIN(fb->buf, fb->len);
        esp_camera_fb_return(fb);
        last_transmission = millis(); 
      }
  }

  // Send GPS Data every 2 seconds
  if (current_time - last_gps_time > 2000) {
      
      // We use static variables to remember the count from 2 seconds ago
      static uint32_t last_chars_processed = 0;
      uint32_t current_chars = gps.charsProcessed();

      // DIAGNOSTIC 1: Is the wire actually plugged in right now?
      if (current_chars == last_chars_processed) {
          // Serial.println("[GPS CRITICAL] WIRE DISCONNECTED! No new data flowing to ESP32.");
      } 
      // DIAGNOSTIC 2: The wire is plugged in, but is it backward?
      else if (gps.passedChecksum() == 0) {
          // Serial.println("[GPS ERROR] Receiving garbage noise. Swap TX and RX wires!");
      }
      // DIAGNOSTIC 3: Wiring is perfect, waiting on space.
      else if (!gps.location.isValid()) {
          // Serial.print("[GPS STATUS] Wiring PERFECT. Searching the sky... Satellites: ");
          // Serial.println(gps.satellites.value());
      } 
      // DIAGNOSTIC 4: Success!
      else {
          char jsonPayload[100];
          snprintf(jsonPayload, sizeof(jsonPayload), "{\"type\":\"gps\", \"lat\":%.6f, \"lon\":%.6f}", gps.location.lat(), gps.location.lng());
          webSocket.sendTXT(jsonPayload);
          // Serial.println("[GPS SUCCESS] Coordinates sent to server.");
      }
      
      last_chars_processed = current_chars;
      last_gps_time = current_time;
  }

  // CRITICAL FOR STABILITY: Gives the WiFi modem time to clear its queue
  delay(10); 
}