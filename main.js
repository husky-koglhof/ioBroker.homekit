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
            adapter.subscribeForeignStates("*");
            main();
            adapter.log.debug(JSON.stringify(allSensors));
        });
    },
    objectChange: function (id, obj) {
        // adapter.log.debug("objectChange for " + id + " found");
    },
    stateChange: function (id, state) {
        // adapter.log.debug("stateChange for " + id + ", state: " + JSON.stringify(state));
        states[id] = state;

        var address = createAddress(objects[id]);
        //adapter.log.debug("ADDRESS = " + address);
        var sensorObject = allSensors[address];
        var value = state.val;

        if (sensorObject != undefined) {
            adapter.log.debug("   VALUE: " + value + " id = " + id);
            var service = eval(sensorObject[0]);
            var characteristic = eval(sensorObject[1]);
            var sensor = sensorObject[2];

            var oldValue = sensor.getService(service).getCharacteristic(characteristic).value;

            // Bugfix: zwave Switch comes with State 0 / 1
            if (sensorObject[0] == 'Service.Switch') {
                adapter.log.debug("is Switch = true");
                var i = parseInt(value);
                if (i == 0) {
                    value = false;
                } else if (i == 1) {
                    value = true;
                }

                var o = parseInt(oldValue);
                if (o == 0) {
                    oldValue = false;
                } else if (o == 1) {
                    oldValue = true;
                }
            } else if (sensorObject[0] == 'Service.Lightbulb') {
                adapter.log.debug("is Lightbulb = true");
                var i = parseInt(value);
                if (sensorObject[1] == 'Characteristic.Brightness') {
                    adapter.log.debug("brightness");
                } else {
                    if (i == 0) {
                        value = false;
                    } else if (i > 0) {
                        value = true;
                    }
                }
            } else {
                // If value has decimal, convert to Float
                if (value !== true && value !== false && value !== "true" && value !== "false") {
                    value = parseFloat(value);
                    if (value % 1 == 0) value = parseInt(value);
                }
            }

            adapter.log.debug("OLDVALUE: " + oldValue);
            adapter.log.debug("NEWVALUE: " + value);
            if (oldValue != value) {
                adapter.log.debug("1. Change state for " + address + " to " + value + " ack = " + state.ack);

                adapter.log.debug("2. Change state for " + address + " to " + value + " ack = " + state.ack);

                if (value !== NaN && value !== null && value !== "NaN") {
                    adapter.log.info("3. Change state for " + address + " to " + value + " ack = " + state.ack);

                    sensor
                        .getService(service)
                        .setCharacteristic(characteristic, value);

                    if (sensorObject[1] == 'Characteristic.Brightness') {
                        if (value == 0) {
                            sensor
                                .getService(service)
                                .setCharacteristic(Characteristic.On, false);
                        } else if (value > 0 ) {
                            sensor
                                .getService(service)
                                .setCharacteristic(Characteristic.On, true);
                        }
                    }
                }
            } else if (sensorObject[1] == 'Characteristic.Brightness') {
                if (value !== NaN && value !== null && value !== "NaN") {
                    adapter.log.info("4. Change state for " + address + " to " + value + " ack = " + state.ack);

                    sensor
                        .getService(service)
                        .setCharacteristic(characteristic, value);
                    if (value == 0) {
                        sensor
                            .getService(service)
                            .setCharacteristic(Characteristic.On, false);
                    } else if (value > 0 ) {
                        sensor
                            .getService(service)
                            .setCharacteristic(Characteristic.On, true);
                    }
                }

            }
        }
    },
    unload: function (callback) {
        callback();
    },
});

var thermostat = [];
var humidity = [];
var battery = [];
var alarm = [];
var setpoint = [];
var switches = [];
var temperature = [];
var lightbulb = [];

function getParent(address) {
    var a = address.split('.');
    var l = a.length;
    var b = "";
    for (var i = 0; i < a.length - 1; i++) {
        b += a[i] + ".";
    }
    return b.substr(0, b.length-1);
}

function getRoot(address) {
    var a = address.split('.');
    if (a.length >= 3) {
        return a[0]+"."+a[1]+"."+a[2];
    } else {
        return address;
    }
}

function getData(callback) {
    var statesReady;
    var objectsReady;

    adapter.log.debug('requesting all states');
    adapter.getForeignStates('*', function (err, res) {
        states = res;
        statesReady = true;
        adapter.log.debug('received all states');
        if (objectsReady && typeof callback === 'function') callback();
    });

    adapter.log.debug('requesting all objects');
    adapter.objects.getObjectList({include_docs: true}, function (err, res) {
        res = res.rows;
        objects = {};
        for (var i = 0; i < res.length; i++) {
            objects[res[i].doc._id] = res[i].doc;
            if (res[i].doc.type === 'enum') enums.push(res[i].doc._id);
            var obj = res[i].doc;
            // TODO: Remove hardcoded WeatherUnderGround
            if (obj._id != undefined && obj._id.search("forecast") < 0) {
                if (obj.common !== undefined && obj.common.role == "value.humidity") {
                    var parent = getParent(obj._id);
                    var pobj = objects[parent];
                    if (pobj.native.PARENT_TYPE != undefined && pobj.native.PARENT_TYPE != "HM-CC-TC") {
                        humidity.push(obj._id);
                    }
                }
                if (obj.common !== undefined && obj.common.role == "value.temperature") thermostat.push(obj._id);
                if (obj.common !== undefined && obj.common.role == "indicator.battery") battery.push(obj._id);
                if (obj.common !== undefined && obj.common.role == "value.battery") battery.push(obj._id);
                if (obj.common !== undefined && obj.common.role == "alarm") alarm.push(obj._id);
                if (obj.common !== undefined && obj.common.role == "level.temperature") setpoint.push(obj._id);
                if (obj.common !== undefined && obj.common.role == "switch") switches.push(obj._id);
                if (obj.common !== undefined && obj.common.role == "level.dimmer") lightbulb.push(obj._id);
            }
        }

        objectsReady = true;
        adapter.log.debug('received all objects');
        if (statesReady && typeof callback === 'function') callback();
    });
}

var HAP = require('hap-nodejs');
var uuid = HAP.uuid;
var Bridge = HAP.Bridge;
var Accessory = HAP.Accessory;
var Service = HAP.Service;
var Characteristic = HAP.Characteristic;
var bridge;

function main() {
    adapter.log.info("hap-nodejs starting...");

    var storage = require('hap-nodejs/node_modules/node-persist');
    var types = require('hap-nodejs/accessories/types');
    var bridgename = adapter.config.bridgename;

    // Initialize our storage system

    var store = adapter.adapterDir + "/../../iobroker-data/homekit.0";
    storage.initSync({ dir: store });
    //storage.initSync();

    // Start by creating our Bridge which will host all loaded Accessories
    bridge = new Bridge(bridgename, uuid.generate(bridgename));

    // Listen for bridge identification event
    bridge.on('identify', function (paired, callback) {
        adapter.log.info("Node Bridge identify:" + paired);
        callback(); // success
    });

    var accessories = adapter.config.Accessories;
    var types = {};

    var map = new Object();

    for (var acc_name in accessories) {
        var accessory = accessories[acc_name];
        for (var obj_name in accessory) {
            var object = accessory[obj_name];
            adapter.log.debug("Accessory: " + acc_name + " Object: " + obj_name);
            for (var addr_name in object) {
                var address = object[addr_name];
                // TODO: Check if this accessory is already defined
                if (types[addr_name] == undefined) {
                    types[addr_name] = {};
                }
                types[addr_name][acc_name] = acc_name;
            }
        }
    }

    for (var i = 0; i < humidity.length; i++) {
        var temp = humidity[i];
        if (createAccessory['Humidity']) {
            object = objects[temp];
            accessory = accessories['Humidity'];
            map.object = object;
            map.accessory = accessory;
            map.types = types;

            bridge.addBridgedAccessory(createAccessory['Humidity'](map));
        } else {
            adapter.log.error("UNKNOWN SERVICE");
        }
        map = new Object();
    }

    for (var i = 0; i < temperature.length; i++) {
        var temp = temperature[i];
        if (createAccessory['Temperature']) {
            object = objects[temp];
            accessory = accessories['Temperature'];
            map.object = object;
            map.accessory = accessory;
            map.types = types;

            bridge.addBridgedAccessory(createAccessory['Temperature'](map));
        } else {
            adapter.log.error("UNKNOWN SERVICE");
        }
        map = new Object();
    }

    for (var i = 0; i < thermostat.length; i++) {
        var temp = thermostat[i];
        if (createAccessory['Thermostat']) {
            object = objects[temp];
            accessory = accessories['Thermostat'];
            map.object = object;
            map.accessory = accessory;
            map.types = types;

            bridge.addBridgedAccessory(createAccessory['Thermostat'](map));
        } else {
            adapter.log.error("UNKNOWN SERVICE");
        }
        map = new Object();
    }

    for (var i = 0; i < switches.length; i++) {
        var sw = switches[i];

        object = objects[sw];
        // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
        if (object.native.PARENT_TYPE != undefined) {
            if (createAccessory['Switch']) {
                accessory = accessories['Switch'];
                map.object = object;
                map.accessory = accessory;

                bridge.addBridgedAccessory(createAccessory['Switch'](map));
            } else {
                adapter.log.error("UNKNOWN SERVICE");
            }
        }
        if (object.common.type == "boolean") {
            if (createAccessory['Switch']) {
                accessory = accessories['Switch'];
                map.object = object;
                map.accessory = accessory;

                bridge.addBridgedAccessory(createAccessory['Switch'](map));
            } else {
                adapter.log.error("UNKNOWN SERVICE");
            }
        }
        map = new Object();
    }

    for (var i = 0; i < lightbulb.length; i++) {
        var di  = lightbulb[i];

        object = objects[di];
        // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
        if (object.native.PARENT_TYPE != undefined) {
            if (createAccessory['Lightbulb']) {
                accessory = accessories['Lightbulb'];
                map.object = object;
                map.accessory = accessory;

                bridge.addBridgedAccessory(createAccessory['Lightbulb'](map));
            } else {
                adapter.log.error("UNKNOWN SERVICE");
            }
        }
        if (object.common.type == "number") {
            if (createAccessory['Lightbulb']) {
                accessory = accessories['Lightbulb'];
                map.object = object;
                map.accessory = accessory;

                bridge.addBridgedAccessory(createAccessory['Lightbulb'](map));
            } else {
                adapter.log.error("UNKNOWN SERVICE");
            }
        }
        map = new Object();

    }
    // Publish the Bridge on the local network.
    bridge.publish({
        username: adapter.config.username,
        port: parseInt(adapter.config.port),
        pincode: adapter.config.pincode,
        category: adapter.config.category
    });

    adapter.log.info("Bridge '" + bridgename + "' successfully published");
    adapter.log.debug("UserName: " + adapter.config.username);
    adapter.log.debug("PinCode:  " + adapter.config.pincode);
    adapter.log.debug("Port:     " + adapter.config.port);
    adapter.log.debug("Category: " + adapter.config.category);
}

function identify(settings, paired, callback) {
    adapter.log.debug('< hap ' + settings.name + ' identify ' + paired);
    if (settings.topic.identify) {
        adapter.log.debug('> iobroker ' + settings.topic.identify + " " + settings.payload.identify);
        // TODO: mqtt.publish(settings.topic.identify, settings.payload.identify);
    }
    callback();
}

function setInfos(acc, settings) {
    if (settings.ADDRESS || settings.TYPE) {
        acc.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Homematic" || "-")
            .setCharacteristic(Characteristic.Model, settings.TYPE || "-" )
            .setCharacteristic(Characteristic.SerialNumber, settings.ADDRESS || "-");
    }
}

var allSensors = {};

var createAccessory = {
    Humidity: function createAccessory_Humidity(settings) {
        var object = settings.object;
        var accessory = settings.accessory;
        var types = settings.types;

        var s = object._id.split(".");
        var a;
        for (var i = 0; i < s.length-2; i++) {
            if (a === undefined) {
                a = s[i];
            } else {
                a = a + "." + s[i];
            }
        }
        var p = objects[a];
        var t;
        if (p !== undefined && p.native.TYPE !== undefined) {
            t = p.native.TYPE;
        }
        var objName = createName(object);
        var address = createAddress(object);

        var sensorUUID = uuid.generate('hap-nodejs:accessories:humidity:' + address + "_" + objName);
        var sensor = new Accessory(objName, sensorUUID);
        setInfos(sensor, object.native);

        adapter.log.debug('> iobroker subscribe Humidity ' + address );

        if (t !== undefined && accessory['CurrentRelativeHumidity'][t] !== undefined) {
            sensor.addService(Service.HumiditySensor)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on('get', function (callback) {
                    var addr = p._id + "." + accessory['CurrentRelativeHumidity'][t];
                    adapter.log.debug('< hap ' + objName + ' get CurrentRelativeHumidity for ' + addr);

                    value = parseFloat(states[addr].val);
                    //adapter.subscribeForeignStates(addr);
                    if (callback) callback(null, value);
                });
            var addr = p._id + "." + accessory['CurrentRelativeHumidity'][t];
        } else {
            sensor.addService(Service.HumiditySensor)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on('get', function(callback) {
                    var addr = object._id;
                    adapter.log.debug('< hap ' + objName + ' get CurrentRelativeHumidity for ' + addr);

                    value = parseFloat(states[addr].val);
                    //adapter.subscribeForeignStates(addr);
                    if (callback) callback(null, value);
                });
            var addr = object._id;
        }
        allSensors[addr] = ['Service.HumiditySensor', 'Characteristic.CurrentRelativeHumidity', sensor];
        return sensor;
    },
    Temperature: function createAccessory_Temperature(settings) {
        var object = settings.object;
        var accessory = settings.accessory;
        var types = settings.types;

        var s = object._id.split(".");
        var a;
        for (var i = 0; i < s.length-2; i++) {
            if (a === undefined) {
                a = s[i];
            } else {
                a = a + "." + s[i];
            }
        }
        var p = objects[a];
        var t;
        if (p !== undefined && p.native.TYPE !== undefined) {
            t = p.native.TYPE;
        }
        var objName = createName(object);
        var address = createAddress(object);

        var sensorUUID = uuid.generate('hap-nodejs:accessories:temperature:' + address + "_" + objName);
        var sensor = new Accessory(objName, sensorUUID);
        setInfos(sensor, object.native);

        adapter.log.debug('> iobroker subscribe Temperature ' + address );

        if (t !== undefined && accessory['CurrentTemperature'][t] !== undefined) {
            var service = sensor.addService(Service.TemperatureSensor);
            var char = service.getCharacteristic(Characteristic.CurrentTemperature);
            char.setProps({minValue: -100});

            var action = char.on('get', function (callback) {
                var addr = p._id + "." + accessory['CurrentTemperature'][t];
                adapter.log.debug('< hap ' + objName + ' get CurrentTemperature for ' + addr);

                value = parseFloat(states[addr].val);
                //adapter.subscribeForeignStates(addr);
                if (callback) callback(null, value);
            });
            var addr = p._id + "." + accessory['CurrentTemperature'][t];
        } else {
            var service = sensor.addService(Service.TemperatureSensor);
            var char = service.getCharacteristic(Characteristic.CurrentTemperature);
            char.setProps({minValue: -100});

            var action = char.on('get', function (callback) {
                var addr = object._id;
                adapter.log.debug('< hap ' + objName + ' get CurrentTemperature for ' + addr);

                value = parseFloat(states[addr].val);
                //adapter.subscribeForeignStates(addr);
                if (callback) callback(null, value);
            });
            var addr = object._id;
        }
        allSensors[addr] = ['Service.TemperatureSensor', 'Characteristic.CurrentTemperature', sensor];
        return sensor;
    },
    Thermostat: function createAccessory_Thermostat(settings) {

        var object = settings.object;
        var accessory = settings.accessory;
        var types = settings.types;

        // TODO: Try to get Parent Device so we can check which Type this Temperature is
        // Homematic Devices have alway PARENT_TYPE set e.g. HM-CC-TC
        var s = object._id.split(".");
        var a;
        for (var i = 0; i < s.length-2; i++) {
            if (a === undefined) {
                a = s[i];
            } else {
                a = a + "." + s[i];
            }
        }
        var p = objects[a];
        var t;
        if (p !== undefined && p.native.TYPE !== undefined) {
            t = p.native.TYPE;
        }

        var objName = createName(object);
        var address = createAddress(object);

        var sensorUUID = uuid.generate('hap-nodejs:accessories:thermostat:' + address + "_" + objName);
        var sensor = new Accessory(objName, sensorUUID);
        setInfos(sensor, object.native);

        adapter.log.debug('> iobroker subscribe Thermostat ' + address );

        if (p != undefined && p._id != undefined) {
            var addr = p._id + "." + accessory['CurrentTemperature'][t];
            adapter.log.debug('< hap ' + objName + ' get CurrentTemperature for ' + addr);

            if (t !== undefined) {
                if (accessory['CurrentTemperature'][t] !== undefined) {
                    sensor.addService(Service.Thermostat)
                        .getCharacteristic(Characteristic.CurrentTemperature)
                        .on('get', function (callback) {
                            var addr = p._id + "." + accessory['CurrentTemperature'][t];
                            adapter.log.debug('< hap ' + objName + ' get CurrentTemperature for ' + addr);

                            value = parseFloat(states[addr].val);
                            //adapter.subscribeForeignStates(addr);
                            if (callback) callback(null, value);
                        });
                    var addr = p._id + "." + accessory['CurrentTemperature'][t];
                    allSensors[addr] = ['Service.Thermostat', 'Characteristic.CurrentTemperature', sensor];
                }
                if (accessory['TargetTemperature'][t] !== undefined) {
                    sensor.getService(Service.Thermostat)
                        .getCharacteristic(Characteristic.TargetTemperature)
                        .on('get', function (callback) {
                            var addr = p._id + "." + accessory['TargetTemperature'][t];
                            adapter.log.debug('< hap ' + objName + ' get TargetTemperature for ' + addr);

                            value = parseFloat(states[addr].val);
                            //adapter.subscribeForeignStates(addr);
                            if (callback) callback(null, value);
                        });
                    var addr = p._id + "." + accessory['TargetTemperature'][t];
                    allSensors[addr] = ['Service.Thermostat', 'Characteristic.TargetTemperature', sensor];

                    sensor.getService(Service.Thermostat)
                        .getCharacteristic(Characteristic.TargetTemperature)
                        .on('set', function (value, callback) {
                            var addr = p._id + "." + accessory['TargetTemperature'][t];
                            adapter.log.debug('< hap ' + objName + ' get TargetTemperature for ' + addr);

                            adapter.setForeignState(addr, {val: value, ack: false});
                            callback();
                        });
                }

                if (accessory['CurrentRelativeHumidity'][t] !== undefined) {
                    sensor.getService(Service.Thermostat)
                        .addCharacteristic(new Characteristic.CurrentRelativeHumidity())
                        .on('get', function (callback) {
                            var addr = p._id + "." + accessory['CurrentRelativeHumidity'][t];
                            adapter.log.debug('< hap ' + objName + ' get CurrentRelativeHumidity for ' + addr);

                            value = parseFloat(states[addr].val);
                            //adapter.subscribeForeignStates(addr);
                            if (callback) callback(null, value);
                        });
                    var addr = p._id + "." + accessory['CurrentRelativeHumidity'][t];
                    allSensors[addr] = ['Service.Thermostat', 'Characteristic.CurrentRelativeHumidity', sensor];

                }
            } else {
                var service = sensor.addService(Service.TemperatureSensor);
                var char = service.getCharacteristic(Characteristic.CurrentTemperature);
                char.setProps({minValue: -100});

                var action = char.on('get', function (callback) {
                    var addr = object._id;
                    adapter.log.debug('< hap ' + objName + ' get CurrentTemperature for ' + addr);

                    value = parseFloat(states[addr].val);
                    //adapter.subscribeForeignStates(addr);
                    if (callback) callback(null, value);
                });
                var addr = object._id;
                allSensors[addr] = ['Service.TemperatureSensor', 'Characteristic.CurrentTemperature', sensor];
            }
        } else {
            var service = sensor.addService(Service.TemperatureSensor);
            var char = service.getCharacteristic(Characteristic.CurrentTemperature);
            char.setProps({minValue: -100});

            var action = char.on('get', function (callback) {
                var addr = object._id;
                adapter.log.debug('< hap ' + objName + ' get CurrentTemperature for ' + addr);

                value = parseFloat(states[addr].val);
                //adapter.subscribeForeignStates(addr);
                if (callback) callback(null, value);
            });
            var addr = object._id;
            allSensors[addr] = ['Service.TemperatureSensor', 'Characteristic.CurrentTemperature', sensor];
        }
        return sensor;
    },
    Switch: function createAccessory_Switch(settings) {

        var object = settings.object;
        var accessory = settings.accessory;

        var objName = createName(object);
        var address = createAddress(object);

        var sensorUUID = uuid.generate('hap-nodejs:accessories:switch:' + address + "_" + objName);
        var sensor = new Accessory(objName, sensorUUID);
        setInfos(sensor, object.native);

        adapter.log.debug('> iobroker subscribe Switch ' + address );

        sensor.addService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', function (callback) {
                var addr;
                // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
                if (object.native.PARENT_TYPE != undefined) {
                    addr = object._id + accessory['State'][object.native.PARENT_TYPE];
                } else {
                    addr = object._id;
                }
                adapter.log.debug('< hap ' + objName + ' get Switch for ' + addr);

                value = states[addr].val;
                if (value === true || value === 0 || value === "0") {
                    value = true;
                } else if (value === false || value === 1 || value === "1") {
                    value = false;
                } else {
                    value = false;
                }

                //adapter.subscribeForeignStates(addr);
                if (callback) callback(null, value);
            });

        sensor.getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('change', function(values) {
                var addr;
                // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
                if (object.native.PARENT_TYPE != undefined) {
                    addr = object._id + accessory['State'][object.native.PARENT_TYPE];
                } else {
                    addr = object._id;
                }
                var value;

                // Bugfix: zwave Switch comes with State 0 / 1
                var i = parseInt(values.newValue);
                if (i === 0) {
                    value = false;
                } else if (i === 1) {
                    value = true;
                } else {
                    value = values.newValue;
                }

                adapter.log.debug("CHANGED: " + addr + " = " + value);
                if (values.context !== undefined) {
                    adapter.setForeignState(addr, {val: value, ack: false});
                }
            });
        var addr;
        // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
        if (object.native.PARENT_TYPE != undefined) {
            addr = object._id + accessory['State'][object.native.PARENT_TYPE];
        } else {
            addr = object._id;
        }
        adapter.log.debug("ADDRESS FOR SWITCH = " + addr);
        allSensors[addr] = ['Service.Switch', 'Characteristic.On', sensor];
        return sensor;
    },
    Lightbulb: function createAccessory_Lightbulb(settings) {

        var object = settings.object;
        var accessory = settings.accessory;

        var objName = createName(object);
        var address = createAddress(object);

        var sensorUUID = uuid.generate('hap-nodejs:accessories:lightbulb:' + address + "_" + objName);
        var sensor = new Accessory(objName, sensorUUID);
        setInfos(sensor, object.native);

        adapter.log.debug('> iobroker subscribe LightBulb ' + address );

        sensor.addService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function (callback) {
                var addr;
                // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
                if (object.native.PARENT_TYPE != undefined) {
                    addr = object._id + accessory['State'][object.native.PARENT_TYPE];
                } else {
                    addr = object._id;
                }
                adapter.log.debug('< hap ' + objName + ' get Lightbulb(on) for ' + addr);

                value = states[addr].val;
                if (callback) callback(null, value);
            });

        sensor.getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('change', function(values) {
                var addr;
                // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
                if (object.native.PARENT_TYPE != undefined) {
                    addr = object._id + accessory['State'][object.native.PARENT_TYPE];
                } else {
                    addr = object._id;
                }
                var value;

                // Bugfix: Homematic Dimmer comes with State true / false, convert to 100 / 0
                var i = eval(values.newValue);
                if (i === true) {
                    value = 100;
                } else if (i === false) {
                    value = 0;
                } else {
                    value = values.newValue;
                }

                adapter.log.debug("CHANGED: " + addr + " = " + value);
                if (values.context !== undefined) {
                    adapter.log.info("CHANGED: " + addr + " = " + value);
                    adapter.setForeignState(addr, {val: value, ack: false});
                }
            });

        sensor.getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) {
                var addr;
                // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
                if (object.native.PARENT_TYPE != undefined) {
                    addr = object._id + accessory['State'][object.native.PARENT_TYPE];
                } else {
                    addr = object._id;
                }
                adapter.log.debug('< hap ' + objName + ' get Lightbulb(brightness) for ' + addr);

                value = states[addr].val;
                if (callback) callback(null, value);
            });

        sensor.getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Brightness)
            .on('change', function(values) {
                adapter.log.debug(JSON.stringify(values));

                var value;
                value = values.newValue;

                if (values.context !== undefined) {
                    adapter.setForeignState(addr, {val: value, ack: false});
                }
            });

        var addr;
        // Homematic Switches have PARENT_TYPE e.g. HM-LC-Sw2-FM
        if (object.native.PARENT_TYPE != undefined) {
            addr = object._id + accessory['State'][object.native.PARENT_TYPE];
        } else {
            addr = object._id;
        }
        adapter.log.debug("ADDRESS FOR LIGHTBULB = " + addr);
        allSensors[addr] = ['Service.Lightbulb', 'Characteristic.Brightness', sensor];
        return sensor;
    }
};

function createAddress(object) {
    if (object == undefined) {
        return "";
    }
    var address;
    if (object.native !== undefined && object.native.ADDRESS !== undefined) {
        address = object.native.ADDRESS;
    } else {
        address = object._id;
    }

    return address;
}

function createName(object) {
    var objName;
    if (object.common.name !== undefined && object.common.name !== "") {
        objName = object.common.name;
    } else {
        var root = getRoot(object._id);
        var robj = objects[root];
        if (robj.common.name !== undefined && robj.common.name !== "") {
            objName = robj.common.name;
        } else {
            objName = object._id;
        }
    }
    return objName;
}