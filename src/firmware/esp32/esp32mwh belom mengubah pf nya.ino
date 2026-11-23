#include <ModbusMaster.h>
#include <HardwareSerial.h>
#include <cstring>
#include <stdint.h>

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
#define REG_ENERGY     3204  // Active Energy Delivered (Wh)

ModbusMaster node;
HardwareSerial modbusSerial(2);

// ==========================================
// MAX485 TRANSMIT MODE
// ==========================================
void preTransmission()
{
  digitalWrite(MAX485_DE_RE, HIGH);
}

// ==========================================
// MAX485 RECEIVE MODE
// ==========================================
void postTransmission()
{
  digitalWrite(MAX485_DE_RE, LOW);
}

// ==========================================
// Convert 2 x 16-bit registers -> Float32
// ==========================================
float registersToFloat(uint16_t reg1, uint16_t reg2)
{
  uint32_t raw = ((uint32_t)reg1 << 16) | reg2;

  float value;
  memcpy(&value, &raw, sizeof(value));

  return value;
}

// ==========================================
// READ FLOAT FROM PM5350
// ==========================================
bool readFloatRegister(uint16_t reg, float &value)
{
  uint16_t address = reg - 1;

  uint8_t result = node.readHoldingRegisters(address, 2);

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
// READ ENERGY: INT64 (4 registers) -> MWh
// Register 3204 = Active Energy Delivered
// Original unit: Wh
// ==========================================
bool readEnergyMWh(uint16_t reg, double &energyMWh)
{
  uint16_t address = reg - 1;

  uint8_t result = node.readHoldingRegisters(address, 4);

  if (result == node.ku8MBSuccess)
  {
    // Assumption: register buffer is MSW -> LSW
    uint64_t raw =
      ((uint64_t)node.getResponseBuffer(0) << 48) |
      ((uint64_t)node.getResponseBuffer(1) << 32) |
      ((uint64_t)node.getResponseBuffer(2) << 16) |
      ((uint64_t)node.getResponseBuffer(3));

    // Register type in PM5350 documentation: INT64
    int64_t energyWh = (int64_t)raw;

    // Wh -> MWh
    energyMWh = (double)energyWh / 1000000.0;

    return true;
  }

  Serial.print("ERROR Energy Register ");
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

  pinMode(MAX485_DE_RE, OUTPUT);
  digitalWrite(MAX485_DE_RE, LOW);

  modbusSerial.begin(
    9600,
    SERIAL_8N1,
    RX_PIN,
    TX_PIN
  );

  node.begin(SLAVE_ID, modbusSerial);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  Serial.println("Modbus RTU Started");
  Serial.println("Slave ID : 10");
  Serial.println("Baud     : 9600");
  Serial.println("Format   : 8N1");
  Serial.println("RX2      : GPIO16 -> RO");
  Serial.println("TX2      : GPIO17 -> DI");
  Serial.println("DE + RE  : GPIO4");
  Serial.println("Energy   : Register 3204 (Wh -> MWh)");
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
  double energyMWh;

  Serial.println("======================================");
  Serial.println("             PM5350 DATA");
  Serial.println("======================================");

  // CURRENT
  if (readFloatRegister(REG_CURRENT, current))
  {
    Serial.print("Current      : ");
    Serial.print(current, 2);
    Serial.println(" A");
  }

  delay(300);

  // VOLTAGE
  if (readFloatRegister(REG_VOLTAGE, voltage))
  {
    Serial.print("Voltage      : ");
    Serial.print(voltage, 2);
    Serial.println(" V");
  }

  delay(300);

  // ACTIVE POWER
  if (readFloatRegister(REG_POWER, power))
  {
    Serial.print("Active Power : ");
    Serial.print(power, 3);
    Serial.println(" kW");
  }

  delay(300);

  // POWER FACTOR
  if (readFloatRegister(REG_PF, powerFactor))
  {
    Serial.print("Power Factor : ");
    Serial.println(powerFactor, 3);
  }

  delay(300);

  // FREQUENCY
  if (readFloatRegister(REG_FREQUENCY, frequency))
  {
    Serial.print("Frequency    : ");
    Serial.print(frequency, 2);
    Serial.println(" Hz");
  }

  delay(300);

  // ACTIVE ENERGY DELIVERED (E Del)
  if (readEnergyMWh(REG_ENERGY, energyMWh))
  {
    Serial.print("E Del        : ");
    Serial.print(energyMWh, 3);
    Serial.println(" MWh");
  }

  Serial.println("======================================");
  Serial.println();

  delay(3000);
}