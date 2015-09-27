![Logo](admin/homekit.png)
ioBroker HomeKit Adapter
==============

HomeKit Adapter for ioBroker

With this Adapter it is possible to use your iOS Device native for ioBroker Home Automation.

Within Admin Settings you can set following Attributes
- username
- port
- pincode

![admin-settings](img/admin_settings.png)

## Installation
For Usage you must define a enum named enum.homekit.
There you must include all needed Objects.
Set a common Name for all Objects e.g. hm-rpc.0.JEQ0225305.1.TEMPERATURE = Kinderzimmer

You can use every Homekit App on iOS. These Version is tested with Elgato Eve cause it's free.

Currently implemented are: Homematic Thermostat and Homematic Switch.
Within Homekit you can see the actual temperature from the Thermostat.
The Switch can be used within Homekit.

## Changelog
### 0.0.3 (2015-09-27)
 - (husky-koglhof) added Support for HM-CC-TC, HM-CC-RT-DN and BC-RT-TRX-CyG-3 Thermostat
   Supported now Actual Temperature, Set Temperature, Humidity
 
### 0.0.2 (2015-09-27)
 - (husky-koglhof) Refresh States if "Room" is refreshed.
 
### 0.0.1 (2015-09-26)
 - (husky-koglhof) Initial commit. Still non-functional.

## Todo
Implement set Temperature for Homematic, etc.

## License

## Lizenz

Copyright (c) 2015 husky-koglhof

[CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)

Der obige Urheberrechtsvermerk ist in allen Kopien oder Teilkopien der Software beizulegen.

DIE SOFTWARE WIRD OHNE JEDE AUSDRÜCKLICHE ODER IMPLIZIERTE GARANTIE BEREITGESTELLT, EINSCHLIESSLICH DER GARANTIE ZUR BENUTZUNG FÜR DEN VORGESEHENEN ODER EINEM BESTIMMTEN ZWECK SOWIE JEGLICHER RECHTSVERLETZUNG, JEDOCH NICHT DARAUF BESCHRÄNKT. IN KEINEM FALL SIND DIE AUTOREN ODER COPYRIGHTINHABER FÜR JEGLICHEN SCHADEN ODER SONSTIGE ANSPRÜCHE HAFTBAR ZU MACHEN, OB INFOLGE DER ERFÜLLUNG EINES VERTRAGES, EINES DELIKTES ODER ANDERS IM ZUSAMMENHANG MIT DER SOFTWARE ODER SONSTIGER VERWENDUNG DER SOFTWARE ENTSTANDEN.

HomeMatic und BidCoS sind eingetragene Warenzeichen der [eQ-3 AG](http://eq-3.de)
