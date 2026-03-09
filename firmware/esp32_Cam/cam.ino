#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsClient.h>

// ==========================================
// 1. WiFi Credentials
// ==========================================
const char* ssid = "Teoh";
const char* password = "Kailun2003";

// ==========================================
// 2. Ngrok WebSocket Configuration
// ==========================================
const char* ws_host = "marcel-brutelike-conciliatingly.ngrok-free.dev";
const int ws_port = 443; // Port 443 is required for secure connections (wss://)
const char* ws_url = "/ws";

WebSocketsClient webSocket;
unsigned long last_frame_time = 0;
bool send_next_frame = false;

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

// Function to handle incoming messages from your Python server
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("SUCCESS: WebSocket Connected to Python Server!");
      break;
    case WStype_TEXT:
      Serial.printf("Message from Server: %s\n", payload);
      // If Python sends the word "NEXT", flip our flag to true
      if (strncmp((char*)payload, "NEXT", 4) == 0) {
         send_next_frame = true;
      }
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("\n--- OUTDOOR EDGE DEVICE START ---");

  // memory check
  if(psramFound()){
      Serial.println("SUCCESS: PSRAM is enabled and working!");
    } else {
      Serial.println("CRITICAL ERROR: PSRAM is NOT found! Check Tools > PSRAM settings.");
    }

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
  config.frame_size = FRAMESIZE_QVGA;   
  config.pixel_format = PIXFORMAT_JPEG; 
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 10;
  config.fb_count = 2;

  // Initialize Camera
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

  // Connect WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Initialize Secure WebSocket Client
  webSocket.beginSSL(ws_host, ws_port, ws_url);
  webSocket.onEvent(webSocketEvent);
  
  // If the connection drops, try to reconnect every 5 seconds
  webSocket.setReconnectInterval(5000); 

  // Ping server every 15s, wait 3s for pong, disconnect if it fails 2 times
  webSocket.enableHeartbeat(15000, 3000, 2);
}

void loop() {
  webSocket.loop();

  // Only take a picture if Python specifically asked for one
  if (send_next_frame && webSocket.isConnected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    
    if (fb) {
      webSocket.sendBIN(fb->buf, fb->len);
      esp_camera_fb_return(fb);
    }
    
    // Reset the flag so we don't send another one until Python asks again
    send_next_frame = false; 
  }
  
  delay(1); // Essential 1ms delay to keep the WiFi chip from crashing
}