var express = require('express');
var app = express();
var concur = require('concur-platform');
var config = require('./config');
var async = require('async');
var util = require('util');
var Type = require('type-of-is');
var querystring = require('querystring');
var https = require('https');

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use( bodyParser.urlencoded() ); // to support URL-encoded bodies

app.get('/', function(request, response) {
  response.send('Hello World Concur!');
});

var concurAccessToken = config.concur.accessToken;
var googleAPIKey      = config.google.apiKey;

// This endpoint gets the upcoming segment from entire Concur trip
app.get('/segments', function(req, res) {
	//var reqBody = req.body;
	//var allSegments = reqBody.allSegments;

	//if(reqBody.loggedIn) {
	if(true) { // wow
		async.waterfall([
			// 1. Get upcoming itinerary from several tripIDs
			function(callback) {
				var options = {
					oauthToken: concurAccessToken
				}

				concur.itinerary.get(options)
				.then(function(data) {

					var itinArray = data;
					itinArray.sort(function(a, b){return new Date(a.StartDateLocal) - new Date(b.StartDateLocal)});

					var d = new Date();
					var i = 0;
					while(i < itinArray.length && d > new Date(itinArray[i].EndDateLocal)) i++;

					callback(null, itinArray[i].TripId);
				})
				.fail(function(error) {
					// Error
					callback(error, "Error: " + error);
				});
			},

			// 2. Collect all segments (Hotel + Air) and sort according to travel date/time
			function(tripId, callback) {
				var options = {
					oauthToken: concurAccessToken,
					id: tripId
				}

				concur.itinerary.get(options)
				.then(function(data) {
					var bookings = data.Itinerary.Bookings.Booking;
					var segmentArray = [];

					for(var i = 0; i < bookings.length; i++) {

						if(typeof(bookings[i].Segments.Hotel) != "undefined") {
							bookings[i].Segments.Hotel.SegmentType = "Hotel";
							segmentArray.push(bookings[i].Segments.Hotel);
						}
						if (typeof(bookings[i].Segments.Air) != "undefined") {
							// 'Air' could be an array, or not
							if(Type.is(bookings[i].Segments.Air, Array)) {
								var airArray = bookings[i].Segments.Air;
								for(var j = 0; j < airArray.length; j++) {
									airArray[j].SegmentType = "Air";
									segmentArray.push(airArray[j]);
								}
							}
							else {
								bookings[i].Segments.Air.SegmentType = "Air";
								segmentArray.push(bookings[i].Segments.Air);
							}
						}
					}

					segmentArray.sort(function(a, b){return new Date(a.StartDateLocal) - new Date(b.StartDateLocal)});

					callback(null, segmentArray);
				})
				.fail(function(error) {
					callback(error, "Error: " + error);
				});
			},

			// 3. Identify upcoming segment and flag it
			function(segmentArray, callback) {

				var d = new Date();
				var i = 0;
				while(i < segmentArray.length && d > new Date(segmentArray[i].StartDateLocal)) i++;

				for(var j = 0; j < segmentArray.length; j++) {

					// flag whether next segment or not
					if(i == j) segmentArray[j].IsNext = "true";
					else segmentArray[j].IsNext = "false";

				}

				callback(null, segmentArray);
			},

			// 4. Get coordinate and addresses for each segment location using Google Geocode API
			function(segmentArray, callback) {

				var host = "maps.googleapis.com";
				var endpoint = "/maps/api/geocode/json";

				async.mapLimit(segmentArray, 3, function(segment, callback){
					var city;
					var address;

					if(segment.SegmentType == "Air") {
						var d = new Date();
						if(d < (new Date(segment.StartDateLocal))) city = segment.StartCityCode;
						else city = segment.EndCityCode;

						address = city + " airport";
					}
					else if (segment.SegmentType == "Hotel") {
						city = segment.StartCityCode;
						address = segment.Name;
					}

					doRequest(host, endpoint, 'GET', {
						"address": address,
						"key": googleAPIKey
					  }, function(data) {

						var zipCode = getZipCode(data.results[0].address_components);

						segment.Location =
						{
							"city" : city,
							"address" : data.results[0].formatted_address,
							"coordinates" : data.results[0].geometry.location,
							"zipCode" :	zipCode
						}

						//var returnObj;
						//if(allSegments == 'true') returnObj = segmentArray;
						//else returnObj = segment;

						callback(null, segment);
					});

				}, function(err, results){
				    // results is now an array of stats for each file

				    callback(null, results);
				});

			}

		],
		function(err, result) {

			res.send(result);
		});

	}
	else {
		//TODO: Handle login
		res.send({ "loggedIn": "false"});
	}
});

// This endpoint gets the upcoming segment from entire Concur trip
app.get('/segment', function(req, res) {
	//var reqBody = req.body;
	//var allSegments = reqBody.allSegments;

	//if(reqBody.loggedIn) {
	if(true) { // wow
		async.waterfall([
			// 1. Get upcoming itinerary from several tripIDs
			function(callback) {
				var options = {
					oauthToken: concurAccessToken
				}

				concur.itinerary.get(options)
				.then(function(data) {

					var itinArray = data;
					itinArray.sort(function(a, b){return new Date(a.StartDateLocal) - new Date(b.StartDateLocal)});

					var d = new Date();
					var i = 0;
					while(i < itinArray.length && d > new Date(itinArray[i].EndDateLocal)) i++;

					callback(null, itinArray[i].TripId);
				})
				.fail(function(error) {
					// Error
					callback(error, "Error: " + error);
				});
			},

			// 2. Collect all segments (Hotel + Air) and sort according to travel date/time
			function(tripId, callback) {
				var options = {
					oauthToken: concurAccessToken,
					id: tripId
				}

				concur.itinerary.get(options)
				.then(function(data) {
					var bookings = data.Itinerary.Bookings.Booking;
					var segmentArray = [];

					for(var i = 0; i < bookings.length; i++) {

						if(typeof(bookings[i].Segments.Hotel) != "undefined") {
							bookings[i].Segments.Hotel.SegmentType = "Hotel";
							segmentArray.push(bookings[i].Segments.Hotel);
						}
						if (typeof(bookings[i].Segments.Air) != "undefined") {
							// 'Air' could be an array, or not
							if(Type.is(bookings[i].Segments.Air, Array)) {
								var airArray = bookings[i].Segments.Air;
								for(var j = 0; j < airArray.length; j++) {
									airArray[j].SegmentType = "Air";
									segmentArray.push(airArray[j]);
								}
							}
							else {
								bookings[i].Segments.Air.SegmentType = "Air";
								segmentArray.push(bookings[i].Segments.Air);
							}
						}
					}

					segmentArray.sort(function(a, b){return new Date(a.StartDateLocal) - new Date(b.StartDateLocal)});

					callback(null, segmentArray);
				})
				.fail(function(error) {
					callback(error, "Error: " + error);
				});
			},

			// 3. Identify upcoming segment and flag it
			function(segmentArray, callback) {

				var d = new Date();
				var i = 0;
				while(i < segmentArray.length && d > new Date(segmentArray[i].StartDateLocal)) i++;

				var j = 0;
				for(j = 0; j < segmentArray.length; j++) {

					// flag whether next segment or not
					if(i == j) segmentArray[j].IsNext = "true";
					else segmentArray[j].IsNext = "false";

				}

				callback(null, segmentArray[i]);
			},

			// 4. Get coordinate and addresses for segment location using Google Geocode API
			function(segment, callback) {

				var host = "maps.googleapis.com";
				var endpoint = "/maps/api/geocode/json";


					var city;
					var address;

					if(segment.SegmentType == "Air") {
						var d = new Date();
						if(d < (new Date(segment.StartDateLocal))) city = segment.StartCityCode;
						else city = segment.EndCityCode;

						address = city + " airport";
					}
					else if (segment.SegmentType == "Hotel") {
						city = segment.StartCityCode;
						address = segment.Name;
					}

					doRequest(host, endpoint, 'GET', {
						"address": address,
						"key": googleAPIKey
					  }, function(data) {

						var zipCode = getZipCode(data.results[0].address_components);

						segment.Location =
						{
							"city" : city,
							"address" : data.results[0].formatted_address,
							"coordinates" : data.results[0].geometry.location,
							"zipCode" :	zipCode
						}

						//var returnObj;
						//if(allSegments == 'true') returnObj = segmentArray;
						//else returnObj = segment;

						callback(null, segment);
					});

			}

		],
		function(err, result) {

			res.send(result);
		});

	}
	else {
		//TODO: Handle login
		res.send({ "loggedIn": "false"});
	}
});


app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

//

function doRequest(host, endpoint, method, data, success) {
  var dataString = JSON.stringify(data);
  var headers = {};

  if (method == 'GET') {
    endpoint += '?' + querystring.stringify(data);
  }
  else {
    headers = {
      'Content-Type': 'application/json',
      'Content-Length': dataString.length
    };
  }
  var options = {
    host: host,
    path: endpoint,
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
      console.log(responseString);
      var responseObject = JSON.parse(responseString);
      success(responseObject);
    });
  });

  req.write(dataString);
  req.end();
}

function getZipCode(addComponents) {
	var zipCode;

	for(var i=0; i < addComponents.length; i++) {
		if(addComponents[i].types[0] == "postal_code") {
			zipCode = addComponents[i].short_name;
			break;
		}
	}

	return zipCode;
}
