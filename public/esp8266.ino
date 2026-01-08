#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ================= PIN CONFIG =================
#define IN1 D1
#define IN2 D2
#define PIR D5
#define DHTPIN 12 
#define DHTTYPE DHT11

// ================= WIFI & API =================
const char* ssid = "EN_POR";
const char* password = "0812622140";
const char* apiUrl = "https://iot-fan-ppkz.vercel.app/api/device"; 

// ================= OBJECTS =================
DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure client;
HTTPClient http;

// ================= VARIABLES =================
unsigned long lastMotionTime = 0;
const unsigned long fanOffDelay = 120000; 
unsigned long lastSyncTime = 0;
const unsigned long syncInterval = 2000; 

float currentTemp = 0.0;
bool fanOn = false;
bool manualMode = false;

// *** เพิ่มตัวแปรเก็บอุณหภูมิเป้าหมาย (ค่าเริ่มต้น 28.0) ***
float targetTemp = 28.0; 

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(PIR, INPUT);
  digitalWrite(IN1, HIGH); digitalWrite(IN2, HIGH); 
  
  dht.begin();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nConnected");
  client.setInsecure();
}

// ================= LOOP =================
void loop() {
  float t = dht.readTemperature();
  if (!isnan(t)) currentTemp = t;
  
  int pirState = digitalRead(PIR);
  bool motionDetected = (pirState == HIGH);

  if (millis() - lastSyncTime > syncInterval) {
    lastSyncTime = millis();
    syncWithCloud(motionDetected);
  }

  // === Logic ควบคุมพัดลม ===
  if (!manualMode) { // AUTO MODE
    if (motionDetected) {
       // *** ใช้ตัวแปร targetTemp แทนตัวเลข 15.0 ***
       if (currentTemp >= targetTemp || fanOn) {
           lastMotionTime = millis(); 
           // *** ใช้ตัวแปร targetTemp แทนตัวเลข 15.0 ***
           if (!fanOn && currentTemp >= targetTemp) { 
             controlFan(true);
           }
       }
    }
    
    if (fanOn) {
      long timeLeft = (fanOffDelay - (millis() - lastMotionTime)) / 1000;
      if (timeLeft <= 0) {
         controlFan(false);
      }
    }
  }
}

// ================= HELPER FUNCTIONS =================

void controlFan(bool state) {
  fanOn = state;
  if (fanOn) { digitalWrite(IN1, LOW); digitalWrite(IN2, LOW); } 
  else { digitalWrite(IN1, HIGH); digitalWrite(IN2, HIGH); }
}

void syncWithCloud(bool motion) {
  if (WiFi.status() == WL_CONNECTED) {
    StaticJsonDocument<200> docToSend;
    docToSend["temp"] = currentTemp;
    docToSend["motion"] = motion;
    docToSend["fan_status"] = fanOn;
    
    String jsonString;
    serializeJson(docToSend, jsonString);

    http.begin(client, apiUrl);
    http.addHeader("Content-Type", "application/json");
    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
      String response = http.getString();
      StaticJsonDocument<300> docResponse; // ขยาย buffer หน่อยเผื่อข้อมูลเยอะขึ้น
      DeserializationError error = deserializeJson(docResponse, response);

      if (!error) {
        bool cloudManual = docResponse["manual_mode"];
        bool cloudFanCmd = docResponse["fan_command"];
        
        // *** รับค่า target_temp จาก Cloud ***
        float cloudTarget = docResponse["target_temp"];
        
        // ป้องกันค่าเป็น 0 หรือค่าเพี้ยน
        if (cloudTarget > 0) {
           targetTemp = cloudTarget;
        }

        Serial.println("------------- SYNC ------------");
        Serial.print("Mode: "); Serial.println(cloudManual ? "MANUAL" : "AUTO");
        Serial.print("Target Temp: "); Serial.println(targetTemp); // แสดงค่าให้ดู
        Serial.println("-------------------------------");

        manualMode = cloudManual;
        if (manualMode) controlFan(cloudFanCmd);
      }
    }
    http.end();
  }
}