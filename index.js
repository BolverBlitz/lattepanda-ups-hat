require('module-alias/register')

const ArduinoReader = require('@lib/lattepandaups');

const arduino = new ArduinoReader();

arduino.connect('Arduino Leonardo');

setInterval(() => {
    console.log(arduino.convertDataUnits());
}, 1000);