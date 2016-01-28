var ftp = require('ftp-get')
var fs  = require('fs');
var csv = require("csvtojson").Converter;

var remoteFile = "ftp://ftp.nasdaqtrader.com/SymbolDirectory/nasdaqtraded.txt"
var timestamp  = String((new Date).getTime());
var filePath   = "./data/nasdaq/"
var symbolPath = "./data/symbols/"
var localFile  = ""
var extension  = ".psv"

function makeFolder(dir, callback) {
	if (!fs.existsSync(dir)){
	    fs.mkdirSync(dir);
	}
	callback();
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
}

makeFolder("./data", function(){
	makeFolder("./data/nasdaq", function() {
		makeFolder("./data/symbols", function() {
			checkLatestSymbols();
		});
	});
});