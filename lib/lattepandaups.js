const { SerialPort } = require('serialport');

class ArduinoReader {
    constructor() {
        this.port = null;
        this.latestData = {};

        this.lastBatteryVoltage = []; // in mV

        this.emptyVoltage = 9600; // in mV
        this.fullVoltage = 12000; // in mV

        setInterval(() => {
            if(this.latestData['Battery voltage'] != undefined) {
                this.lastBatteryVoltage.push(Number(this.latestData['Battery voltage'].replace('mV', '').trim()));
            }

            this.#keepArrayLength(60);

            this.latestData['Battery voltage average'] = this.#averageBatteryVoltage();

        }, 1000)
    }

    #averageBatteryVoltage() {
        let sum = 0;
        for(let i = 0; i < this.lastBatteryVoltage.length; i++) {
            sum += this.lastBatteryVoltage[i];
        }

        return (sum / this.lastBatteryVoltage.length).toFixed(0) + 'mV';
    }

    #keepArrayLength(length = 60) {
        if(this.lastBatteryVoltage.length > length) {
            this.lastBatteryVoltage.shift();
        }
    }

    async connect(portName) {
        try {
            const ports = await SerialPort.list();
            const arduinoPortInfo = ports.find(port => port.friendlyName && port.friendlyName.startsWith(portName));

            if (arduinoPortInfo) {
                this.port = new SerialPort({
                    path: arduinoPortInfo.path,
                    baudRate: 9600 // Adjust the baud rate as needed
                });

                this.port.on('open', () => {
                    console.log(`Connected to ${portName} on ${arduinoPortInfo.path}`);
                });

                this.port.on('data', (data) => {
                    this.parseData(data.toString());
                });

                this.port.on('error', (err) => {
                    console.error('Error:', err.message);
                });
            } else {
                console.log(`${portName} not found.`);
            }
        } catch (error) {
            console.error('Error connecting to Arduino:', error);
        }
    }

    parseData(dataString) {
        // Split the data string into lines and parse each line
        const lines = dataString.split('\n');
        lines.forEach(line => {
            if (line.trim().length > 0) {
                const parts = line.split('=');
                if (parts.length === 2) {
                    const key = parts[0].trim();
                    const value = parts[1].trim();
                    this.latestData[key] = value;
                }
            }
        });

        this.calculateBatteryPercentage()
    }

    calculateBatteryPercentage() {
        const batteryVoltage = parseInt(this.latestData['Battery voltage']); // in mV
        const dischargeCurrent = parseInt(this.latestData['Battery discharge current']); // in mA
    
        // Estimate the voltage sag
        const internalResistance = 0.1; // One cell got 0.36 ohm internal resistance
        const voltageSag = internalResistance * dischargeCurrent;
    
        // Adjust the battery voltage by the estimated voltage sag
        const adjustedVoltage = batteryVoltage - voltageSag;
    
        // Calculate percentage based on adjusted voltage
        let percentage = (adjustedVoltage - this.emptyVoltage) / (this.fullVoltage - this.emptyVoltage) * 100;
    
        // Ensure percentage is within 0-100 range
        percentage = Math.max(0, Math.min(100, percentage));
    
        this.latestData["iRemaining_real"] = percentage.toFixed(2); // Return percentage with two decimal places
    }

    convertDataUnits(data) {
        const convertedData = {};
    
        for (const key in this.latestData) {
            // Convert key to lowercase and replace spaces with underscores
            const formattedKey = key.toLowerCase().replace(/\s+/g, '_');
    
            // Extract the value and potential unit from the data
            const value = this.latestData[key];
            const matches = value.match(/(-?\d+\.?\d*)\s*([a-zA-Z]*)/);
            
            if (matches && matches.length === 3) {
                // If there is a unit, add it to the key name and convert the value to a number
                const numValue = parseFloat(matches[1]);
                const unit = matches[2];
                const newKey = unit ? `${formattedKey}_${unit.toLowerCase()}` : formattedKey;
                convertedData[newKey] = numValue;
            } else {
                // If there is no unit or the value is non-numeric, keep the original value
                convertedData[formattedKey] = value;
            }
        }
    
        return convertedData;
    }
}

module.exports = ArduinoReader;