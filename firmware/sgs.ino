#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>
#include <WiFiManager.h>

// ==========================================
// WebSocket Configuration
// ==========================================
const char* ws_host = "beijing-tiles-binding-street.trycloudflare.com";
const int ws_port = 443; 
const char* ws_url = "/ws";

WebSocketsClient webSocket;

// ==========================================
// PIN DEFINITIONS (ESP32-S3 Standard)
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
// AUDIO PIN DEFINITIONS
// ==========================================
#define I2S_BCLK    41
#define I2S_LRC     40
#define I2S_DOUT    42
#define I2S_MIC_SD  1

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("SUCCESS: WebSocket Connected to Python Server!");
      break;
    case WStype_TEXT: {
      String msg = (char*)payload;
      Serial.printf("Received Text: %s\n", msg.c_str());
      
      // If user unpairs from dashboard, erase WiFi and reboot
      if (msg == "COMMAND: RESET_WIFI") {
        Serial.println("Reset command received! Erasing WiFi credentials...");
        WiFiManager wm;
        wm.resetSettings(); // Wipes the saved password from flash memory
        delay(1000);
        ESP.restart();      // Reboots the ESP32 to trigger Phase 1 (Captive Portal)
      }
      break;
    }
    case WStype_BIN:
      size_t bytes_written;
      i2s_write(I2S_NUM_0, payload, length, &bytes_written, portMAX_DELAY);
      break;
  }
}

// Function to initialize the audio (both mic and speaker)
void initAudio() {
  i2s_config_t i2s_config = {
    // Enable both TX (Speaker) and RX (Mic)
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX | I2S_MODE_RX), 
    .sample_rate = 22050,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = true
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num = I2S_MIC_SD
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("[SUCCESS] Full-Duplex Audio Pipeline Online.");
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  Serial.println("\n--- OUTDOOR EDGE DEVICE START ---");

  // Initialize Speaker
  initAudio();

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

  // Initialize WiFiManager
  WiFiManager wm;
  
  // Set a timeout so it doesn't wait in the portal forever if power restarts
  wm.setConfigPortalTimeout(180); // 3 minutes timeout
  
  Serial.println("Starting WiFiManager. Connect to 'AURA_SETUP_GLASSES' on your phone if not paired.");
  
  // This automatically connects to saved WiFi OR opens the portal "AURA_SETUP_GLASSES"
  if (!wm.autoConnect("AURA_SETUP_GLASSES")) {
    Serial.println("Failed to connect and hit timeout. Rebooting...");
    delay(3000);
    ESP.restart(); // Restart and try again
  }
  
  Serial.println("\nWiFi connected successfully!");

  // 1. Grab the ESP32's unique raw MAC Address
  String raw_mac = WiFi.macAddress();
  
  // 2. Remove all the colons (":") from the string
  raw_mac.replace(":", "");
  
  // 3. Prepend your custom system prefix
  String custom_device_id = "SGS-" + raw_mac; 
  
  // 4. Append the formatted ID to the WebSocket URL
  String full_ws_url = String(ws_url) + "?mac=" + custom_device_id;
  
  Serial.println("Connecting to Server with Device ID: " + custom_device_id);

  // 5. Connect using the new dynamic URL
  webSocket.beginSSL(ws_host, ws_port, full_ws_url.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 5000, 3);
}

// ----------------------------------------------------
// THE FIREHOSE: Send autonomously at 15 FPS
// ----------------------------------------------------
unsigned long last_transmission = 0;
const int TARGET_FPS = 15; 
const int FRAME_DELAY = 1000 / TARGET_FPS; 

// digital volume knob
const float MIC_GAIN = 5.0;

void loop() {
  webSocket.loop();
  unsigned long current_time = millis();
  
  // Audio Capture & Uplink
  int16_t mic_samples[256];
  size_t bytes_read = 0;
  // Non-blocking read from mic
  i2s_read(I2S_NUM_0, &mic_samples, sizeof(mic_samples), &bytes_read, 0); 
  
  if (bytes_read > 0) {
    int num_samples = bytes_read / 2;
    // Apply Digital Amplification
    for (int i = 0; i < num_samples; i++) {
      int32_t amplified = mic_samples[i] * MIC_GAIN;

      // Anti-Distortion (Clipping limits)
      if (amplified > 32767) amplified = 32767;
      if (amplified < -32768) amplified = -32768;

      mic_samples[i] = (int16_t)amplified;
    }

    // Send amplified audio bytes to server
    webSocket.sendBIN((uint8_t*)mic_samples, bytes_read);
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

  delay(1); 
}