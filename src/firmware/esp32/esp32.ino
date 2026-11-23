#include <ModbusMaster.h>
#include <HardwareSerial.h>

// ==========================================
// PM5350 CONFIGURATION
// ==========================================
#define SLAVE_ID 10

// ESP32 UART2
#define RX_PIN 16
#define TX_PIN 17

// MAX485 DE + RE disatukan ke GPIO4
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
// MAX485 TRANSMIT MODE
// ==========================================
void preTransmission()
{
  // HIGH = MAX485 mengirim data
  digitalWrite(MAX485_DE_RE, HIGH);
}


// ==========================================
// MAX485 RECEIVE MODE
// ==========================================
void postTransmission()
{
  // LOW = MAX485 menerima data
  digitalWrite(MAX485_DE_RE, LOW);
}


// ==========================================
// Convert 2 x 16-bit register -> Float32
// ==========================================
float registersToFloat(uint16_t reg1, uint16_t reg2)
{
  uint32_t raw;

  raw = ((uint32_t)reg1 << 16) | reg2;

  float value;
  memcpy(&value, &raw, sizeof(value));

  return value;
}


// ==========================================
// READ FLOAT FROM PM5350
// ==========================================
bool readFloatRegister(uint16_t reg, float &value)
{
  uint8_t result;

  // Register PM5350 -> Modbus zero-based address
  uint16_t address = reg - 1;

  result = node.readHoldingRegisters(address, 2);

  if (result == node.ku8MBSuccess)
  {
    uint16_t highWord = node.getResponseBuffer(0);
    uint16_t lowWord  = node.getResponseBuffer(1);

    value = registersToFloat(highWord, lowWord);

    return true;
  }

  Serial.print("ERROR Register ");
  Serial.print(reg);

  Serial.print(" | Modbus Error: 0x");
  Serial.println(result, HEX);

  return false;
}


// ==========================================
// SETUP
// ==========================================
void setup()
{
  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("======================================");
  Serial.println("       PM5350 MODBUS MONITOR");
  Serial.println("======================================");

  // ======================================
  // MAX485 DE + RE
  // ======================================
  pinMode(MAX485_DE_RE, OUTPUT);

  // Default RECEIVE
  digitalWrite(MAX485_DE_RE, LOW);


  // ======================================
  // UART2
  //
  // PM5350:
  // Baud     = 9600
  // Data     = 8 bit
  // Parity   = None
  // Stop Bit = 1
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
  node.begin(SLAVE_ID, modbusSerial);

  // Kontrol arah MAX485
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);


  Serial.println("Modbus RTU Started");
  Serial.println();
  Serial.println("Slave ID : 10");
  Serial.println("Baud     : 9600");
  Serial.println("Parity   : None");
  Serial.println("RX2      : GPIO16 -> RO");
  Serial.println("TX2      : GPIO17 -> DI");
  Serial.println("DE + RE  : GPIO4");
  Serial.println();

  delay(1000);
}


// ==========================================
// LOOP
// ==========================================
void loop()
{
  float current;
  float voltage;
  float power;
  float powerFactor;
  float frequency;


  Serial.println("======================================");
  Serial.println("             PM5350 DATA");
  Serial.println("======================================");


  // ======================================
  // CURRENT / AMPERE
  // Register 3009
  // ======================================
  if (readFloatRegister(REG_CURRENT, current))
  {
    Serial.print("Current      : ");
    Serial.print(current, 2);
    Serial.println(" A");
  }

  delay(300);


  // ======================================
  // VOLTAGE
  // Register 3035
  // ======================================
  if (readFloatRegister(REG_VOLTAGE, voltage))
  {
    Serial.print("Voltage      : ");
    Serial.print(voltage, 2);
    Serial.println(" V");
  }

  delay(300);


  // ======================================
  // ACTIVE POWER
  // Register 3059
  // ======================================
  if (readFloatRegister(REG_POWER, power))
  {
    Serial.print("Active Power : ");
    Serial.print(power, 3);
    Serial.println(" kW");
  }

  delay(300);


  // ======================================
  // POWER FACTOR
  // Register 3083
  // ======================================
  if (readFloatRegister(REG_PF, powerFactor))
  {
    Serial.print("Power Factor : ");
    Serial.println(powerFactor, 3);
  }

  delay(300);


  // ======================================
  // FREQUENCY
  // Register 3109
  // ======================================
  if (readFloatRegister(REG_FREQUENCY, frequency))
  {
    Serial.print("Frequency    : ");
    Serial.print(frequency, 2);
    Serial.println(" Hz");
  }


  Serial.println("======================================");
  Serial.println();

  delay(3000);
}