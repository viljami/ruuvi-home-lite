interface RuuviData {
  dataFormat: number;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  mac: string;
  batteryVoltage: number | null;
  txPower: number | null;
  movementCounter: number | null;
  measurementSequence: number | null;
  accelerationX: number | null;
  accelerationY: number | null;
  accelerationZ: number | null;
}

export class RuuviDecoder {
  static decode(hexData: string): RuuviData | null {
    try {
      // Remove any prefixes and ensure clean hex
      const cleanHex = hexData.replace(/^(0x)?/, '').toUpperCase();
      
      // Data Format 5 should be 24 bytes (48 hex characters)
      if (cleanHex.length !== 48) {
        return null;
      }

      const buffer = Buffer.from(cleanHex, 'hex');
      
      // Check data format
      const dataFormat = buffer.readUInt8(0);
      if (dataFormat !== 5) {
        return null;
      }

      // Convert to data array similar to working implementation
      const data = this.parseDataFields(buffer);

      const accX = this.getAccelerationX(data);
      const accY = this.getAccelerationY(data);
      const accZ = this.getAccelerationZ(data);
      const acceleration = (accX !== null && accY !== null && accZ !== null) 
        ? Math.sqrt(accX * accX + accY * accY + accZ * accZ) : null;

      return {
        dataFormat: 5,
        temperature: this.getTemperature(data),
        humidity: this.getHumidity(data),
        pressure: this.getPressure(data),
        mac: this.getMac(data),
        batteryVoltage: this.getBattery(data),
        txPower: this.getTxPower(data),
        movementCounter: this.getMovementCounter(data),
        measurementSequence: this.getMeasurementSequenceNumber(data),
        accelerationX: accX,
        accelerationY: accY,
        accelerationZ: accZ
      };
    } catch (error) {
      return null;
    }
  }

  private static parseDataFields(buffer: Buffer): number[] {
    return [
      buffer.readUInt8(0),        // data_format
      buffer.readInt16BE(1),      // temperature
      buffer.readUInt16BE(3),     // humidity
      buffer.readUInt16BE(5),     // pressure
      buffer.readInt16BE(7),      // acceleration_x
      buffer.readInt16BE(9),      // acceleration_y
      buffer.readInt16BE(11),     // acceleration_z
      buffer.readUInt16BE(13),    // power_info
      buffer.readUInt8(15),       // movement_counter
      buffer.readUInt16BE(16),    // measurement_sequence
      ...Array.from(buffer.slice(18, 24)) // mac bytes
    ];
  }

  private static getTemperature(data: number[]): number | null {
    if (data[1] === -32768) {
      return null;
    }
    return parseFloat((data[1] / 200).toFixed(2));
  }

  private static getHumidity(data: number[]): number | null {
    if (data[2] === 65535) {
      return null;
    }
    return parseFloat((data[2] / 400).toFixed(2));
  }

  private static getPressure(data: number[]): number | null {
    if (data[3] === 0xFFFF) {
      return null;
    }
    return parseFloat(((data[3] + 50000) / 100).toFixed(2));
  }

  private static getAccelerationX(data: number[]): number | null {
    return data[4] === -32768 ? null : data[4];
  }

  private static getAccelerationY(data: number[]): number | null {
    return data[5] === -32768 ? null : data[5];
  }

  private static getAccelerationZ(data: number[]): number | null {
    return data[6] === -32768 ? null : data[6];
  }

  private static getBattery(data: number[]): number | null {
    const batteryVoltage = data[7] >> 5;
    if (batteryVoltage === 0b11111111111) {
      return null;
    }
    return batteryVoltage + 1600;
  }

  private static getTxPower(data: number[]): number | null {
    const txPower = data[7] & 0x001F;
    if (txPower === 0b11111) {
      return null;
    }
    return -40 + (txPower * 2);
  }

  private static getMovementCounter(data: number[]): number | null {
    return data[8] === 255 ? null : data[8];
  }

  private static getMeasurementSequenceNumber(data: number[]): number | null {
    return data[9] === 65535 ? null : data[9];
  }

  private static getMac(data: number[]): string {
    return data.slice(10, 16)
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();
  }
}