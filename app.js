var ftp     = require('ftp-get')
var fs      = require('fs');
var csv     = require("csvtojson").Converter;
var request = require("request");
var suspend = require('suspend');

var remoteFile = "ftp://ftp.nasdaqtrader.com/SymbolDirectory/nasdaqtraded.txt"
var timestamp  = String((new Date).getTime());
var filePath   = "./data/nasdaq/";
var symbolPath = "./data/symbols/";
var pricePath  = "./data/pricehistory/";
var localFile  = "";
var extension  = ".psv";
var jextension = ".json";
var keys       = [];
var current    = 0;

function makeFolder(dir) {
	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
	}
}

function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
}

function getLatestSymbols(callback) {
	ftp.get(remoteFile, filePath + localFile + timestamp + extension, function (err, res) {
		console.log(err, res)
		callback();
	});
}

function checkLatestSymbols() {
	fs.readdir(filePath, function(err, items) {
		var latest = 0
		for (i in items) {
			var timestamp = parseInt(items[i].split(".")[0]);
			if (timestamp > latest) {
				latest = timestamp
			}
		}
		console.log("Latest Version is: " + String(latest));
		if (timestamp + 1440000 > latest) {
			// Less than a day old, cached version.
			console.log("Using Cached Version of Symbols")
			readLatestSymbols(latest);
		} else {
			// More than a day old, reload it.
			console.log("Grabbing New Symbols")
			getLatestSymbols(function(){checkLatestSymbols();});
		}
	});
}

function pad(width, string, padding) { 
  return (width <= string.length) ? string : pad(width, string + padding, padding)
}

function readLatestSymbols(latest) {
	if (!fileExists(symbolPath + latest + extension)) {
		console.log("Generating New Symbol Data")
		var converter = new csv({
			delimiter:"|"
		});
		converter.on("end_parsed", function (jsonArray) {
			var obj = {}
			for (i in jsonArray) {
				symbol = jsonArray[i]["Symbol"];
				security = jsonArray[i]["Security Name"];
				obj[symbol] = security
				console.log(pad(6, symbol, " ") + " : " + security);
			}
			// console.log(obj);
		    fs.writeFile(symbolPath + timestamp + extension, JSON.stringify(obj), function (err) {
			  	if (err) return console.log(err);
			});
		}); 
		fs.createReadStream(filePath + String(latest) + extension).pipe(converter);
		readLatestSymbols(latest);
	} else {
		console.log("Using Cached Version of Symbol Data");
		listSymbolData(latest);
	}
}

function listSymbolData(latest) {
	fs.readFile(symbolPath + latest + extension, function(err, data) {
		if (err) throw err;
		var symbolList = JSON.parse(data);
		keys = Object.keys(symbolList);
		cacheKeys(latest);
		symbolCall(latest);
	});
}

function cacheKeys(latest) {
	fs.readdir(pricePath + latest, function(err, items) {
		var existingSymbols = [];
		var newKeys = [];
		for (i = 0; i < items.length; i++) {
			existingSymbols.push(items[i].split(".")[0]);
		}
		for (i = 0; i < keys.length; i++) {
			var found = false;
			for (j = 0; j < existingSymbols.length; j++) {
				if (keys[i] == existingSymbols[j]) {
					found = true;
				}
			}
			if (found) {
				// console.log("Found: " + keys[i]);
			} else if (!found) {
				newKeys.push(keys[i]);
				// console.log("Not Found: " + keys[i]);
			}
		}
		keys = newKeys;
	});
}

function symbolCall(latest) {
	getSymbolData(keys[current], function(symbol, body) {
		suspend(function* () {
			current += 1;
			sortData(symbol, body, latest);
		    yield setTimeout(suspend.resume(), 25); // 0.1 second passes..
			symbolCall(latest);
		})();
	});
}

function getSymbolData(symbol, callback) {
	var url = 'http://dev.markitondemand.com/MODApis/Api/v2/InteractiveChart/json?parameters={"Normalized":false,"NumberOfDays":365,"DataPeriod":"Day","Elements":[{"Symbol":"' + symbol + '","Type":"price","Params":["c"]}]}';
	request({
	  	uri: url,
	}, function(error, response, body) {
		callback(symbol, body);
	});
}

function sortData(symbol, body, latest) {
	makeFolder(pricePath);
	makeFolder(pricePath + latest);
    fs.writeFile(pricePath + latest + "/" + symbol + jextension, JSON.stringify(body), function (err) {
	  	if (err) return console.log(err);
	  	console.log("Completed Price Data for: " + symbol);
	});
}

makeFolder("./data");
makeFolder("./data/nasdaq");
makeFolder("./data/symbols");
checkLatestSymbols();