#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ModbusMaster.h>
#include <HardwareSerial.h>

// ==========================================
// WIFI & SUPABASE CONFIGURATION
// ==========================================
const char* ssid = "CUKING";
const char* password = "silahkanpesandulu";

const char* supabaseUrl =
  "https://hhpssctpnctximognkic.supabase.co/rest/v1/generator_logs";

const char* supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhocHNzY3RwbmN0eGltb2dua2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjkwMDIsImV4cCI6MjEwNjM0NTAwMn0.EtRyWaboE1L0Ld42TxSTfRkG7JGwKIB662d1g85Lgzk";


// ==========================================
// PM5350 CONFIGURATION
// ==========================================

#define SLAVE_ID 10

// ESP32 UART2
#define RX_PIN 16
#define TX_PIN 17

// MAX485 DE + RE digabung
#define MAX485_DE_RE 4


// ==========================================
// PM5350 REGISTERS
// ==========================================

#define REG_CURRENT    3010
#define REG_VOLTAGE    3036
#define REG_POWER      3060
#define REG_PF         3084
#define REG_FREQUENCY  3110


ModbusMaster node;
HardwareSerial modbusSerial(2);


// ==========================================
// STRUCT POWER FACTOR
// ==========================================

struct PowerFactorResult {
  float value;
  String type;
};


// ==========================================
// MAX485 TRANSMIT MODE
// ==========================================

void preTransmission() {
  digitalWrite(MAX485_DE_RE, HIGH);
}


// ==========================================
// MAX485 RECEIVE MODE
// ==========================================

void postTransmission() {
  digitalWrite(MAX485_DE_RE, LOW);
}


// ==========================================
// CONVERT 2 x 16-bit REGISTER -> FLOAT32
// ==========================================

float registersToFloat(
  uint16_t reg1,
  uint16_t reg2
) {

  uint32_t raw =
    ((uint32_t)reg1 << 16) | reg2;

  float value;

  memcpy(
    &value,
    &raw,
    sizeof(value)
  );

  return value;
}


// ==========================================
// READ FLOAT FROM PM5350
// ==========================================

bool readFloatRegister(
  uint16_t reg,
  float &value
) {

  uint16_t address =
    reg - 1;

  uint8_t result =
    node.readHoldingRegisters(
      address,
      2
    );


  if (result == node.ku8MBSuccess) {

    uint16_t highWord =
      node.getResponseBuffer(0);

    uint16_t lowWord =
      node.getResponseBuffer(1);


    value =
      registersToFloat(
        highWord,
        lowWord
      );


    return true;
  }


  Serial.print(
    "ERROR Register "
  );

  Serial.print(reg);

  Serial.print(
    " | Modbus Error: 0x"
  );

  Serial.println(
    result,
    HEX
  );


  return false;
}


// ==========================================
// CONVERT RAW PF PM5350
// ==========================================

PowerFactorResult convertPowerFactor(
  float rawPF
) {

  PowerFactorResult result;


  // ======================================
  // 0 sampai 1
  // PF NORMAL / LAGGING
  // ======================================

  if (
    rawPF >= 0.0 &&
    rawPF <= 1.0
  ) {

    result.value =
      rawPF;

    result.type =
      "Lagging";

    return result;
  }


  // ======================================
  // 1 sampai 2
  //
  // Contoh:
  // Raw 1.26
  //
  // PF Aktual:
  // 2 - 1.26
  // = 0.74 Leading
  // ======================================

  if (
    rawPF > 1.0 &&
    rawPF <= 2.0
  ) {

    result.value =
      2.0 - rawPF;

    result.type =
      "Leading";

    return result;
  }


  // ======================================
  // DI LUAR RANGE YANG DIPAKAI
  // ======================================

  result.value =
    rawPF;

  result.type =
    "Unknown";


  return result;
}


// ==========================================
// CONNECT WIFI
// ==========================================

void connectWiFi() {

  Serial.println();

  Serial.print(
    "Menghubungkan ke WiFi"
  );


  WiFi.begin(
    ssid,
    password
  );


  while (
    WiFi.status() != WL_CONNECTED
  ) {

    delay(500);

    Serial.print(".");
  }


  Serial.println();

  Serial.println(
    "WiFi Terhubung!"
  );


  Serial.print(
    "IP Address : "
  );

  Serial.println(
    WiFi.localIP()
  );
}


// ==========================================
// SEND DATA TO SUPABASE
// ==========================================

bool sendToSupabase(
  int genId,
  float voltage,
  float current,
  float power,
  float powerFactor,
  String pfType,
  float frequency
) {

  // ======================================
  // CEK WIFI
  // ======================================

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println(
      "WiFi tidak terhubung."
    );

    return false;
  }


  // ======================================
  // JSON
  //
  // Sesuai database:
  //
  // gen_id
  // voltage
  // current
  // power
  // pf
  // pf_type
  // freq
  // ======================================

  StaticJsonDocument<300> doc;


  doc["gen_id"] =
    genId;

  doc["voltage"] =
    voltage;

  doc["current"] =
    current;

  doc["power"] =
    power;

  doc["pf"] =
    powerFactor;

  doc["pf_type"] =
    pfType;

  doc["freq"] =
    frequency;


  String jsonBody;


  serializeJson(
    doc,
    jsonBody
  );


  Serial.println();

  Serial.println(
    "Sending to Supabase..."
  );

  Serial.println(
    jsonBody
  );


  // ======================================
  // HTTPS CLIENT
  // ======================================

  WiFiClientSecure client;


  // Testing sementara
  client.setInsecure();


  client.setTimeout(
    15000
  );


  HTTPClient https;


  // ======================================
  // START HTTPS
  // ======================================

  if (
    !https.begin(
      client,
      supabaseUrl
    )
  ) {

    Serial.println(
      "Gagal membuka koneksi HTTPS"
    );

    return false;
  }


  https.setTimeout(
    15000
  );


  // ======================================
  // SUPABASE HEADERS
  // ======================================

  https.addHeader(
    "Content-Type",
    "application/json"
  );


  https.addHeader(
    "apikey",
    supabaseKey
  );


  https.addHeader(
    "Authorization",
    String("Bearer ") +
    supabaseKey
  );


  https.addHeader(
    "Prefer",
    "return=representation"
  );


  https.addHeader(
    "Connection",
    "close"
  );


  // ======================================
  // POST
  // ======================================

  int httpResponseCode =
    https.POST(
      jsonBody
    );


  Serial.print(
    "HTTP Response: "
  );

  Serial.println(
    httpResponseCode
  );


  // ======================================
  // SUCCESS
  // ======================================

  if (
    httpResponseCode >= 200 &&
    httpResponseCode < 300
  ) {

    String response =
      https.getString();


    if (
      response.length() > 0
    ) {

      Serial.println(
        response
      );
    }


    Serial.println(
      "Supabase INSERT SUCCESS"
    );


    https.end();


    return true;
  }


  // ======================================
  // ERROR
  // ======================================

  if (
    httpResponseCode > 0
  ) {

    String response =
      https.getString();


    Serial.println(
      "Supabase Response:"
    );


    Serial.println(
      response
    );

  }

  else {

    Serial.print(
      "HTTP Error: "
    );


    Serial.println(
      https.errorToString(
        httpResponseCode
      )
    );
  }


  Serial.println(
    "Supabase INSERT FAILED"
  );


  https.end();


  return false;
}


// ==========================================
// SETUP
// ==========================================

void setup() {

  Serial.begin(
    115200
  );


  delay(
    1000
  );


  Serial.println();

  Serial.println(
    "======================================"
  );

  Serial.println(
    "      PM5350 -> SUPABASE"
  );

  Serial.println(
    "======================================"
  );


  // ======================================
  // WIFI
  // ======================================

  connectWiFi();


  // ======================================
  // MAX485
  // ======================================

  pinMode(
    MAX485_DE_RE,
    OUTPUT
  );


  digitalWrite(
    MAX485_DE_RE,
    LOW
  );


  // ======================================
  // UART2
  // ======================================

  modbusSerial.begin(
    9600,
    SERIAL_8N1,
    RX_PIN,
    TX_PIN
  );


  // ======================================
  // MODBUS MASTER
  // ======================================

  node.begin(
    SLAVE_ID,
    modbusSerial
  );


  node.preTransmission(
    preTransmission
  );


  node.postTransmission(
    postTransmission
  );


  Serial.println();

  Serial.println(
    "Modbus RTU Started"
  );


  Serial.println(
    "Slave ID : 10"
  );

  Serial.println(
    "Baud     : 9600"
  );

  Serial.println(
    "Parity   : None"
  );

  Serial.println(
    "RX2      : GPIO16 -> RO"
  );

  Serial.println(
    "TX2      : GPIO17 -> DI"
  );

  Serial.println(
    "DE + RE  : GPIO4"
  );


  Serial.println();

  Serial.println(
    "Sistem Siap!"
  );
}


// ==========================================
// LOOP
// ==========================================

void loop() {

  // ======================================
  // CEK WIFI
  // ======================================

  if (
    WiFi.status() != WL_CONNECTED
  ) {

    Serial.println(
      "WiFi terputus. Menghubungkan ulang..."
    );


    connectWiFi();
  }


  // ======================================
  // VARIABLE
  // ======================================

  float voltage =
    0;

  float current =
    0;

  float power =
    0;

  float rawPowerFactor =
    0;

  float frequency =
    0;


  bool voltageOK =
    false;

  bool currentOK =
    false;

  bool powerOK =
    false;

  bool pfOK =
    false;

  bool frequencyOK =
    false;


  PowerFactorResult pfResult;

  pfResult.value =
    0;

  pfResult.type =
    "Unknown";


  Serial.println();

  Serial.println(
    "======================================"
  );

  Serial.println(
    "             PM5350 DATA"
  );

  Serial.println(
    "======================================"
  );


  // ======================================
  // CURRENT
  // ======================================

  currentOK =
    readFloatRegister(
      REG_CURRENT,
      current
    );


  if (currentOK) {

    Serial.print(
      "Current      : "
    );

    Serial.print(
      current,
      2
    );

    Serial.println(
      " A"
    );
  }


  delay(300);


  // ======================================
  // VOLTAGE
  // ======================================

  voltageOK =
    readFloatRegister(
      REG_VOLTAGE,
      voltage
    );


  if (voltageOK) {

    Serial.print(
      "Voltage      : "
    );

    Serial.print(
      voltage,
      2
    );

    Serial.println(
      " V"
    );
  }


  delay(300);


  // ======================================
  // POWER
  // ======================================

  powerOK =
    readFloatRegister(
      REG_POWER,
      power
    );


  if (powerOK) {

    Serial.print(
      "Power        : "
    );

    Serial.print(
      power,
      3
    );

    Serial.println();
  }


  delay(300);


  // ======================================
  // POWER FACTOR
  // ======================================

  pfOK =
    readFloatRegister(
      REG_PF,
      rawPowerFactor
    );


  if (pfOK) {

    // Konversi nilai raw
    pfResult =
      convertPowerFactor(
        rawPowerFactor
      );


    Serial.print(
      "PF Raw       : "
    );

    Serial.println(
      rawPowerFactor,
      3
    );


    Serial.print(
      "Power Factor : "
    );

    Serial.print(
      pfResult.value,
      3
    );


    Serial.print(
      " "
    );


    Serial.println(
      pfResult.type
    );
  }


  delay(300);


  // ======================================
  // FREQUENCY
  // ======================================

  frequencyOK =
    readFloatRegister(
      REG_FREQUENCY,
      frequency
    );


  if (frequencyOK) {

    Serial.print(
      "Frequency    : "
    );

    Serial.print(
      frequency,
      2
    );

    Serial.println(
      " Hz"
    );
  }


  Serial.println(
    "======================================"
  );


  // ======================================
  // KIRIM KE SUPABASE
  // ======================================

  if (
    voltageOK &&
    currentOK &&
    powerOK &&
    pfOK &&
    frequencyOK
  ) {

    bool sent =
      sendToSupabase(
        1,
        voltage,
        current,
        power,

        // PF yang sudah dikonversi
        pfResult.value,

        // Leading / Lagging
        pfResult.type,

        frequency
      );


    if (sent) {

      Serial.println(
        "Power Meter 1 berhasil dikirim."
      );
    }

  }

  else {

    Serial.println(
      "Data tidak dikirim karena pembacaan Modbus tidak lengkap."
    );
  }


  Serial.println();


  // ======================================
  // INTERVAL UPLOAD
  // ======================================

  delay(
    5000
  );
}