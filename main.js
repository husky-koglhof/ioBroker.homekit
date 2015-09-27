/**
 *      HomeKit Adapter
 *
 *      License: GNU LGPL
 */

var utils =             require(__dirname + '/lib/utils'); // Get common adapter utils
var objects =           {};
var states =            {};
var enums =             [];

var adapter = utils.adapter({
    name: 'homekit',

    ready: function () {
        getData(function () {
            //adapter.subscribeObjects('*');
            //adapter.subscribeStates('*');

            main();
        });
    },
    objectChange: function (id, obj) {
        adapter.log.info("objectChange for " + id + " found");
    },
    stateChange: function (id, state) {
        adapter.log.info("stateChange for " + id + ", state: " + JSON.stringify(state));
    },
    unload: function (callback) {
        callback();
    },
});

function getData(callback) {
    var statesReady;
    var objectsReady;

    adapter.log.info('requesting all states');
    adapter.getForeignStates('*', function (err, res) {
        states = res;
        statesReady = true;
        adapter.log.info('received all states');
        if (objectsReady && typeof callback === 'function') callback();
    });
    adapter.log.info('requesting all objects');

    adapter.objects.getObjectList({include_docs: true}, function (err, res) {
        res = res.rows;
        objects = {};
        for (var i = 0; i < res.length; i++) {
            objects[res[i].doc._id] = res[i].doc;
            if (res[i].doc.type === 'enum') enums.push(res[i].doc._id);
        }

        objectsReady = true;
        adapter.log.info('received all objects');
        if (statesReady && typeof callback === 'function') callback();
    });
}

var HAP = require('HAP-NodeJS');
var uuid = HAP.uuid;
var Bridge = HAP.Bridge;
var Accessory = HAP.Accessory;
var Service = HAP.Service;
var Characteristic = HAP.Characteristic;

var lightbulb;
var temperatursensor;

function getType(type) {
    for (var x = 0; x < temperatursensor.length; x++) {
        if (type == temperatursensor[x]) {
            return "Thermostat";
        }
    }

    for (var x = 0; x < temperatursensor.length; x++) {
        if (type == temperatursensor[x]) {
            return "TemperatureSensor";
        }
    }

    for (var x = 0; x < lightbulb.length; x++) {
        if (type == lightbulb[x]) {
            return "Lightbulb";
        }
    }

    return "undefined";
}

var mappings = {
    Lightbulb: {
        "service":  "Lightbulb",
        "name":     "",
        "topic": {
            "setOn":          "",
            "statusOn":       ""
        },
        "payload": {
            "onTrue": true,
            "onFalse": false
        },
        "manufacturer": "Homematic",
        "model": "Switch"
    },
    TemperatureSensor: {
        "service": "TemperatureSensor",
        "name": "",
        "topic": {
            "statusTemperature": ""
        },
        "manufacturer": "Homematic",
        "model": "Temperature"
    },
    Thermostat: {
        "service": "Thermostat",
        "name": "",
        "topic": {
            "statusTemperature": ""
        },
        "manufacturer": "Homematic",
        "model": "Thermostat"
    },
    Lightbulb_dimmer: {
        "service": "Lightbulb",
        "name": "",
        "topic": {
            "setOn": "",
            "setBrightness": "",
            "statusOn": "",
            "statusBrightness": ""
        },
        "payload": {
            "brightnessFactor": 0.01,
            "onTrue": 1.0,
            "onFalse": 0.0
        },
        "manufacturer": "Homematic",
        "model": "Dimmer"
    },
    LockMechanism: {
        "service": "LockMechanism",
        "name": "",
        "topic": {
            "setLock": "",
            "statusLock": ""
        },
        "payload": {
            "lockUnsecured": "1",
            "lockSecured": "0"
        }
    }
};

function main() {
    adapter.log.info("HAP-NodeJS starting...");

    var storage = require('HAP-NodeJS/node_modules/node-persist');
    var types = require('HAP-NodeJS/accessories/types');

    lightbulb = adapter.config.Lightbulb.split(",");
    temperatursensor = adapter.config.TemperatureSensor.split(",");

    // Initialize our storage system
    storage.initSync();

    // Start by creating our Bridge which will host all loaded Accessories
    var bridge = new Bridge('ioBroker Bridge', uuid.generate("ioBroker Bridge"));

    // Listen for bridge identification event
    bridge.on('identify', function (paired, callback) {
        adapter.log.info("Node Bridge identify:" + paired);
        callback(); // success
    });

    // Create Mapping from Enum / Objects
    var e = "enum.homekit.";
    var map = new Object();
    for (var i=0; i<enums.length; i++) {
        var enu = enums[i];
        if (enu.search(e) == 0) {
            var res = objects[enu];
            var len = res['common'].members.length;
            for (var l = 0; l < len; l++) {
                var member = res['common'].members[l];
                var localObject = objects[member];

                // get device or channel of this state and check it too
                var parts = member.split('.');
                parts.splice(parts.length - 1, 1);
                var channel = parts.join('.');
                parts.splice(parts.length - 1, 1);
                var device = parts.join('.');

                adapter.log.info("Parent Object Adress: " + device);
                var parent = objects[device];
                if (parent.native.TYPE != undefined) {
                    var type = getType(parent.native.TYPE);
                    map = (JSON.parse(JSON.stringify(mappings[type])));

                    if (localObject.common.name == undefined || localObject.common.name == "") {
                        map.name = device;
                    } else {
                        map.name = localObject.common.name;
                    }
                    if (type == "TemperatureSensor" || type == "Thermostat") {
                        adapter.log.info(device + " is a TemperatureSensor");

                        map.topic.statusTemperature = member;

                        // Todo: Remove hardcoded Homematic Types
                        // HM-CC-TC has following Structure
                        // DEVICE.CHANNEL 0 = LOWBAT
                        // DEVICE.CHANNEL 1 = HUMIDITY + TEMPERATURE
                        // DEVICE.CHANNEL 2 = SETPOINT + STATE

                        // HM-CC-RT-DN has following Structure
                        // DEVICE.CHANNEL 0 = LOWBAT
                        // DEVICE.CHANNEL 4 = ACTUAL_TEMPERATURE + VALVE_STATE + SET_TEMPERATURE

                        var actual_temperature;
                        var setpoint;

                        var obj = objects[device];
                        if (obj.native.TYPE == "HM-CC-TC") {
                            map.topic.actual_temperature = device + ".1.TEMPERATURE";
                            map.topic.setpoint = device + ".2.SETPOINT";
                            map.topic.humidity = device + ".1.HUMIDITY";
                        } else if (obj.native.TYPE == "BC-RT-TRX-CyG-3") {
                            map.topic.actual_temperature = device + ".1.ACTUAL_TEMPERATURE";
                            map.topic.setpoint = device + ".1.SET_TEMPERATURE";
                        } else if (obj.native.TYPE == "HM-CC-RT-DN") {
                            map.topic.actual_temperature = device + ".4.ACTUAL_TEMPERATURE";
                            map.topic.setpoint = device + ".4.SET_TEMPERATURE";
                        }
                    } else if (type == "Lightbulb") {
                        adapter.log.info(device + " is a Lightbulb");

                        map.topic.setOn = member;
                        map.topic.statusOn = member;
                    } else {
                        adapter.log.info(device + " is undefined");
                    }

                    if (createAccessory[type]) {
                        bridge.addBridgedAccessory(createAccessory[type](map));
                    } else {
                        log.err('unknown service', a.service, id);
                    }
                    map = new Object();
                }
                var x;
            }
        }
    }

    // Publish the Bridge on the local network.
    bridge.publish({
        username: adapter.config.username,
        port: parseInt(adapter.config.port),
        pincode: adapter.config.pincode,
        category: adapter.config.category
    });
}

function identify(settings, paired, callback) {
    adapter.log.info('< hap ' + settings.name + ' identify ' + paired);
    if (settings.topic.identify) {
        adapter.log.info('> iobroker ' + settings.topic.identify + " " + settings.payload.identify);
        // TODO: mqtt.publish(settings.topic.identify, settings.payload.identify);
    }
    callback();
}

function setInfos(acc, settings) {
    if (settings.manufacturer || settings.model || settings.serial) {
        acc.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, settings.manufacturer || "-")
            .setCharacteristic(Characteristic.Model, settings.model || "-" )
            .setCharacteristic(Characteristic.SerialNumber, settings.serial || "-");
    }
}

var createAccessory = {
    /*
     map[(new Characteristic.On).UUID] = ["switchBinary","switchMultilevel"];
     map[(new Characteristic.Brightness).UUID] = ["switchMultilevel"];
     map[(new Characteristic.CurrentTemperature).UUID] = ["sensorMultilevel.Temperature","thermostat"];
     map[(new Characteristic.TargetTemperature).UUID] = ["thermostat"];
     map[(new Characteristic.TemperatureDisplayUnits).UUID] = ["sensorMultilevel.Temperature","thermostat"]; //TODO: Always a fixed result
     map[(new Characteristic.CurrentHeatingCoolingState).UUID] = ["thermostat"]; //TODO: Always a fixed result
     map[(new Characteristic.TargetHeatingCoolingState).UUID] = ["thermostat"]; //TODO: Always a fixed result
     map[(new Characteristic.CurrentDoorState).UUID] = ["sensorBinary.Door/Window","sensorBinary"];
     map[(new Characteristic.TargetDoorState).UUID] = ["sensorBinary.Door/Window","sensorBinary"]; //TODO: Always a fixed result
     map[(new Characteristic.ObstructionDetected).UUID] = ["sensorBinary.Door/Window","sensorBinary"]; //TODO: Always a fixed result
     map[(new Characteristic.BatteryLevel).UUID] = ["battery.Battery"];
     map[(new Characteristic.StatusLowBattery).UUID] = ["battery.Battery"];
     map[(new Characteristic.ChargingState).UUID] = ["battery.Battery"]; //TODO: Always a fixed result
     map[(new Characteristic.CurrentAmbientLightLevel).UUID] = ["sensorMultilevel.Luminiscence"];
     */


    LockMechanism: function createAccessory_LockMechanism(settings) {

        var lockUUID = uuid.generate('hap-nodejs:accessories:lock:' + settings.topic.setLock);

        var lock = new Accessory(settings.name, lockUUID);

        setInfos(lock, settings);

        lock.on('identify', function (paired, callback) {
            identify(settings, paired, callback);
        });

        lock.addService(Service.LockMechanism, settings.name)
            .getCharacteristic(Characteristic.LockTargetState)
            .on('set', function(value, callback) {
                adapter.log.info('< hap ' + settings.name + ' set LockTargetState' + value);

                if (value == Characteristic.LockTargetState.UNSECURED) {
                    adapter.log.info('> iobroker publish ' + settings.topic.setLock + " " + settings.payload.lockUnsecured);
                    // TODO: mqtt.publish(settings.topic.setLock, settings.payload.lockUnsecured);

                    callback();

                } else if (value == Characteristic.LockTargetState.SECURED) {

                    adapter.log.info('> iobroker publish ' + settings.topic.setLock + " " + settings.payload.lockSecured);
                    // TODO: mqtt.publish(settings.topic.setLock, settings.payload.lockSecured);

                    callback();

                }
            });

        if (settings.topic.statusLock) {

            adapter.log.info('> iobroker subscribe ' + settings.topic.statusLock);
            /* TODO:
             mqttSub(settings.topic.statusLock, function (val) {

             if (val === settings.payload.lockSecured) {
             lock.getService(Service.LockMechanism)
             .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
             }
             if (val === settings.payload.lockUnsecured) {
             lock.getService(Service.LockMechanism)
             .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
             }
             });

             lock.getService(Service.LockMechanism)
             .getCharacteristic(Characteristic.LockCurrentState)
             .on('get', function(callback) {
             adapter.log.info('< hap ' + settings.name + ' get LockCurrentState');

             if (mqttStatus[settings.topic.statusLock] === settings.payload.lockSecured) {
             adapter.log.info('> hap ' + settings.name + ' LockCurrentState.SECURED');
             callback(null, Characteristic.LockCurrentState.SECURED);
             } else {
             adapter.log.info('> hap ' + settings.name + ' LockCurrentState.UNSECURED');
             callback(null, Characteristic.LockCurrentState.UNSECURED);
             }
             });
             */
        }

        return lock;
    },
    Thermostat: function createAccessory_Thermostat(settings) {
        var sensorUUID = uuid.generate('hap-nodejs:accessories:thermostat:' + settings.topic.statusTemperature);
        var sensor = new Accessory(settings.name, sensorUUID);
        setInfos(sensor, settings);

        adapter.log.info('> iobroker subscribe ' + settings.topic.statusTemperature);

        sensor.addService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', function(callback) {
                adapter.log.info('< hap ' + settings.name + ' get TemperatureSensor CurrentTemperature');

                adapter.getForeignState(settings.topic.actual_temperature, function (err, state) {
                    var value;
                    if (err || !state) {
                        value = 0;
                    } else {
                        value = state.val;
                    }
                    if (callback) callback(null, value);
                });
            });

        sensor.getService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', function(callback) {
                if (callback) callback(null, 0); // 0 = OFF, 1 = HEAT, 2 = COOL
            });

        sensor.getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetTemperature)
            .on('get', function(callback) {
                adapter.getForeignState(settings.topic.setpoint, function (err, state) {
                    var value;
                    if (err || !state) {
                        value = 0;
                    } else {
                        value = state.val;
                    }
                    if (callback) callback(null, value);
                });
            });

        sensor.getService(Service.Thermostat)
            .addCharacteristic(new Characteristic.CurrentRelativeHumidity())
            .on('get', function(callback) {
                adapter.getForeignState(settings.topic.humidity, function (err, state) {
                    var value;
                    if (err || !state) {
                        value = 0;
                    } else {
                        value = state.val;
                    }
                    if (callback) callback(null, value);
                });
            });

        return sensor;
    },
    TemperatureSensor: function createAccessory_TemperatureSensor(settings) {

        var sensorUUID = uuid.generate('hap-nodejs:accessories:temperature-sensor:' + settings.topic.statusTemperature);
        var sensor = new Accessory(settings.name, sensorUUID);
        setInfos(sensor, settings);

        adapter.log.info('> iobroker subscribe ' + settings.topic.statusTemperature);
        // TODO: mqtt.subscribe(settings.topic.statusTemperature);

        sensor.addService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', function(callback) {
                adapter.log.info('< hap ' + settings.name + ' get TemperatureSensor CurrentTemperature');

                adapter.getForeignState(settings.topic.statusTemperature, function (err, state) {
                    var value;
                    if (err || !state) {
                        value = 0;
                    } else {
                        value = state.val;
                    }
                    if (callback) callback(null, value);
                });
            });

        return sensor;
    },
    Lightbulb: function createAccessory_Lightbulb(settings) {

        var lightUUID = uuid.generate('hap-nodejs:accessories:light:' + settings.topic.setOn);
        var light = new Accessory(settings.name, lightUUID);
        setInfos(light, settings);

        light.on('identify', function (paired, callback) {
            identify(settings, paired, callback);
        });

        light.addService(Service.Lightbulb, settings.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                adapter.log.info('< hap ' + settings.name + ' set  On ' + value);
                var on = value ? settings.payload.onTrue : settings.payload.onFalse;
                adapter.log.info('> iobroker ' + settings.topic.setOn + " " + on);
                adapter.setForeignState(settings.topic.setOn, {val: on, ack: false});
                callback();
            });

        light.getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function (callback) {
                adapter.log.info('< hap ' + settings.name + ' get On');
                //var on = states[settings.topic.statusOn].val === settings.payload.onTrue;
                //adapter.log.info('> hap ' + settings.name + " " + on);
                //callback(null, on);

                adapter.getForeignState(settings.topic.statusOn, function (err, state) {
                    var value;
                    if (err || !state) {
                        value = 0;
                    } else {
                        value = state.val;
                    }
                    if (callback) callback(null, value);
                });

            });



        if (settings.topic.setBrightness) {
            light.getService(Service.Lightbulb)
                .addCharacteristic(Characteristic.Brightness)
                .on('set', function (value, callback) {
                    console.log('< hap', settings.name, 'set', 'Brightness', value);
                    var bri = (value * (settings.payload.brightnessFactor || 1));
                    console.log('> iobroker', settings.topic.setBrightness, bri);
                    // TODO: mqtt.publish(settings.topic.setBrightness, '' + bri);
                    callback();
                });

            if (settings.topic.statusBrightness) {
                console.log('iobroker subscribe', settings.topic.statusBrightness);
                // TODO: mqtt.subscribe(settings.topic.statusBrightness);
                light.getService(Service.Lightbulb)
                    .getCharacteristic(Characteristic.Brightness)
                    .on('get', function (callback) {
                        console.log('< hap', settings.name, 'get', 'Brightness');
                        // TODO: var brightness = mqttStatus[settings.topic.statusBrightness] / settings.payload.brightnessFactor;
                        var brightness = new Object();
                        console.log('> hap', settings.name, brightness);
                        callback(null, brightness);
                    });

            }

        }

        if (settings.topic.setHue) {
            light.getService(Service.Lightbulb)
                .addCharacteristic(Characteristic.Hue)
                .on('set', function (value, callback) {
                    console.log('< hap', settings.name, 'set', 'Hue', value);
                    console.log('> iobroker', settings.topic.setHue, '' + (value * (settings.payload.hueFactor || 1)));
                    // TODO: mqtt.publish(settings.topic.setHue, '' + (value * (settings.payload.hueFactor || 1)));
                    callback();
                });
            if (settings.topic.statusHue) {
                console.log('iobroker subscribe', settings.topic.statusHue);
                // TODO: mqtt.subscribe(settings.topic.statusHue);
                light.getService(Service.Lightbulb)
                    .getCharacteristic(Characteristic.Hue)
                    .on('get', function (callback) {
                        console.log('< hap', settings.name, 'get', 'Hue');
                        // TODO: var hue = mqttStatus[settings.topic.statusHue] / settings.payload.hueFactor;
                        var hue = new Object();
                        console.log('> hap', settings.name, hue);
                        callback(null, hue);
                    });

            }
        }

        if (settings.topic.setSaturation) {
            light.getService(Service.Lightbulb)
                .addCharacteristic(Characteristic.Saturation)
                .on('set', function (value, callback) {
                    console.log('< hap', settings.name, 'set', 'Saturation', value);
                    var sat = (value * (settings.payload.saturationFactor || 1));
                    console.log('> iobroker', settings.topic.setSaturation, sat);
                    // TODO: mqtt.publish(settings.topic.setSaturation, '' + sat);
                    callback();
                });
            if (settings.topic.statusSaturation) {
                console.log('iobroker subscribe', settings.topic.statusSaturation);
                // TODO: mqtt.subscribe(settings.topic.statusSaturation);
                light.getService(Service.Lightbulb)
                    .getCharacteristic(Characteristic.Saturation)
                    .on('get', function (callback) {
                        console.log('< hap', settings.name, 'get', 'Saturation');
                        // TODO: var saturation = mqttStatus[settings.topic.statusSaturation] / settings.payload.saturationFactor;
                        var saturation = new Object();
                        console.log('> hap', settings.name, saturation);
                        callback(null, saturation);
                    });

            }
        }


        return light;

    },
    Switch: function createAccessory_Switch(settings) {

        var switchUUID = uuid.generate('hap-nodejs:accessories:switch:' + settings.topic.setOn);
        var sw = new Accessory(settings.name, switchUUID);
        setInfos(sw, settings);

        sw.on('identify', function (paired, callback) {
            identify(settings, paired, callback);
        });

        sw.addService(Service.Switch, settings.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                console.log('< hapi ', settings.name, 'set', 'On', value);
                var on = value ? settings.payload.onTrue : settings.payload.onFalse;
                console.log('> iobroker', settings.topic.setOn, on);
                // TODO: mqtt.publish(settings.topic.setOn, '' + on);
                adapter.setState(settings.topic.setOn, on);
                powerOn = value;
                callback();
            });

        if (settings.topic.statusOn) {
            console.log('iobroker subscribe', settings.topic.statusOn);
            // cbaumga mqtt.subscribe(settings.topic.statusOn);
            sw.getService(Service.Switch)
                .getCharacteristic(Characteristic.On)
                .on('get', function (callback) {
                    console.log('< hap', settings.name, 'get', 'On');
                    // TODO: var on = mqttStatus[settings.topic.statusOn] === settings.payload.onTrue;
                    var on = new Object();
                    console.log('> hap', settings.name, on);
                    callback(null, on);
                });

        }

        return sw;
    }
};
