#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>
#include <WiFiManager.h>

// ==========================================
// WebSocket Configuration
// ==========================================
const char* ws_host = "aura.aura-vision.space";
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
#define I2S_MIC_SD  39

// ==========================================
// MOTOR & RGB LED PIN DEFINITIONS
// ==========================================
#define MOTOR_LEFT_PIN  2
#define MOTOR_RIGHT_PIN 14

#define LED_R_PIN 43  // TX Pin
#define LED_G_PIN 44  // RX Pin
#define LED_B_PIN 21

// ==========================================
// BATTERY PIN DEFINITION
// ==========================================
#define BATTERY_PIN 1

// ==========================================
// GLOBAL STATE VARIABLES (Must be above webSocketEvent)
// ==========================================
unsigned long motor_left_end_time = 0;
unsigned long motor_right_end_time = 0;
bool motor_left_active = false;
bool motor_right_active = false;

// LED Blinking States
bool is_waiting_for_pair = false;
unsigned long last_blink_time = 0;
bool led_blink_state = false;

// ==========================================
// HELPER FUNCTIONS (Must be above webSocketEvent)
// ==========================================
// Helper function to set RGB Colors (0-255)
void setLEDColor(int r, int g, int b) {
  if (is_waiting_for_pair && (r != 0 || g != 0 || b != 0)) return; // Don't override blinking
  analogWrite(LED_R_PIN, r);
  analogWrite(LED_G_PIN, g);
  analogWrite(LED_B_PIN, b);
}

int getBatteryPercentage() {
  // Read the raw ADC value (0 - 4095 for 12-bit ADC)
  int rawValue = analogRead(BATTERY_PIN);
  
  // Convert to voltage (assuming 3.3V reference)
  float pinVoltage = (rawValue / 4095.0) * 3.3;
  
  // Multiply by 2 because we split the voltage in half with our resistors
  float batteryVoltage = pinVoltage * 2.0; 
  
  // Map LiPo voltage (3.3V empty - 4.2V full) to 0-100%
  int percentage = (batteryVoltage - 3.3) / (4.2 - 3.3) * 100;
  
  // Clamp values so it doesn't say 105% or -10%
  if (percentage > 100) percentage = 100;
  if (percentage < 0) percentage = 0;

  return percentage;
}

// ==========================================
// WEBSOCKET EVENT
// ==========================================
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
      
      // 1. Unpair & Factory Reset
      if (msg == "COMMAND: RESET_WIFI") {
        Serial.println("Erasing WiFi credentials...");
        setLEDColor(255, 0, 0); // Red for reset
        WiFiManager wm;
        wm.resetSettings(); 
        delay(1000);
        ESP.restart();      
      }
      
      // 2. Trigger Haptic Motor
      else if (msg == "ALERT: MOTOR_LEFT") {
        digitalWrite(MOTOR_LEFT_PIN, HIGH);
        motor_left_active = true;
        motor_left_end_time = millis() + 600; 
      }
      else if (msg == "ALERT: MOTOR_RIGHT") {
        digitalWrite(MOTOR_RIGHT_PIN, HIGH);
        motor_right_active = true;
        motor_right_end_time = millis() + 600; 
      }
      else if (msg == "ALERT: MOTOR_BOTH") {
        digitalWrite(MOTOR_LEFT_PIN, HIGH);
        digitalWrite(MOTOR_RIGHT_PIN, HIGH);
        motor_left_active = true;
        motor_right_active = true;
        motor_left_end_time = millis() + 600; 
        motor_right_end_time = millis() + 600;
      }
      
      // 3. Pairing Status LED
      else if (msg == "STATUS: WAITING_FOR_PAIR") {
        is_waiting_for_pair = true;
      }
      else if (msg == "STATUS: PAIRED") {
        is_waiting_for_pair = false;
        setLEDColor(0, 255, 0); // Solid Green when successfully paired
      }
      
      // 4. Mode Indicator LEDs
      else if (msg == "MODE: NORMAL") {
        setLEDColor(0, 0, 0); // LED off or dim to save battery
      }
      else if (msg == "MODE: NAVIGATION") {
        setLEDColor(0, 255, 0); // Green for Navigation
      }
      else if (msg == "MODE: OCR") {
        setLEDColor(255, 100, 0); // Orange for OCR
      }
      else if (msg == "MODE: TOOL" || msg == "MODE: GUIDANCE") {
        setLEDColor(0, 100, 255); // Light Blue for AI Tool Search
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

  delay(3000);

  Serial.setDebugOutput(false);
  Serial.println("\n--- OUTDOOR EDGE DEVICE START ---");

  // Initialize Motor and RGB LED
  pinMode(MOTOR_LEFT_PIN, OUTPUT);
  pinMode(MOTOR_RIGHT_PIN, OUTPUT);
  digitalWrite(MOTOR_LEFT_PIN, LOW);
  digitalWrite(MOTOR_RIGHT_PIN, LOW);
  
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  
  // Turn LED White to indicate booting up
  analogWrite(LED_R_PIN, 50);
  analogWrite(LED_G_PIN, 50);
  analogWrite(LED_B_PIN, 50);

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
  config.xclk_freq_hz = 10000000;       
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
      s->set_gain_ctrl(s, 1);       // Enable Auto-Gain Control (AGC)
      s->set_exposure_ctrl(s, 1);   // Enable Auto-Exposure Control (AEC)
      s->set_awb_gain(s, 1);        // Enable Auto White Balance
      s->set_aec2(s, 1);            // Enable Advanced AEC DSP
      s->set_ae_level(s, 0);        // Set exposure target to normal (0)
      s->set_bpc(s, 1);             // Enable Black Pixel Correction
      s->set_wpc(s, 1);             // Enable White Pixel Correction
      s->set_lenc(s, 1);            // Enable Lens Correction (Crucial for new lenses)
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
  
  // --- NON-BLOCKING MOTOR SHUTOFF ---
  if (motor_left_active && current_time > motor_left_end_time) {
    digitalWrite(MOTOR_LEFT_PIN, LOW);
    motor_left_active = false;
  }
  if (motor_right_active && current_time > motor_right_end_time) {
    digitalWrite(MOTOR_RIGHT_PIN, LOW);
    motor_right_active = false;
  }

  static unsigned long last_battery_send = 0;
  if (current_time - last_battery_send > 10000) { // Every 10 seconds
    int batt_pct = getBatteryPercentage();
    int rssi = WiFi.RSSI();

    String telemetryMsg = "{\"type\": \"telemetry\", \"battery\": " + String(batt_pct) + ", \"signal\": " + String(rssi) + "}";
    webSocket.sendTXT(telemetryMsg);
    
    last_battery_send = current_time;
  }

  // --- NON-BLOCKING LED BLINK (Waiting for Pair) ---
  if (is_waiting_for_pair) {
    if (current_time - last_blink_time > 500) { // Blink every 500ms
      led_blink_state = !led_blink_state;
      if (led_blink_state) {
        analogWrite(LED_R_PIN, 150); // Yellow
        analogWrite(LED_G_PIN, 100);
        analogWrite(LED_B_PIN, 0);
      } else {
        analogWrite(LED_R_PIN, 0);
        analogWrite(LED_G_PIN, 0);
        analogWrite(LED_B_PIN, 0);
      }
      last_blink_time = current_time;
    }
  }

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