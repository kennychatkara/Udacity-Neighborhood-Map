/**
 * Application Model Data (may be provided by a server, if desired)
 */
var markerListData = [
    {
        title: "Space Needle",
        address: "400 Broad St, Seattle, WA 98109",
        lat: 47.620664,
        lng: -122.349281,
        wikiPageId: 242937
    },
    {
        title: "University of Washington",
        address: "Seattle, WA 98105",
        lat: 47.655234,
        lng: -122.302954,
        wikiPageId: 31776
    },
    {
        title: "Museum of Flight",
        address: "9404 E Marginal Way S, Seattle, WA 98108",
        lat: 47.518000,
        lng: -122.296384,
        wikiPageId: 516528
    },
    {
        title: "Pike Place Market",
        address: "Seattle, WA",
        lat: 47.609597,
        lng: -122.341549,
        wikiPageId: 19547609
    },
    {
        title: "Kerry Park",
        address: "211 W Highland Dr, Seattle, WA 98119",
        lat: 47.629469,
        lng: -122.359922,
        wikiPageId: 805610
    },
    {
        title: "Lake Union",
        address: "Seattle, WA",
        lat: 47.639591,
        lng: -122.333256,
        wikiPageId: 221046
    }
];

var mapDefaults = {
    center: {
        lat: 47.6061989,
        lng: -122.3348833
    },
    zoom: 11,
    streetViewControl: false
};

// In general, these details should be on server only, so as to not expose client API credentials
var apiCredentials = {
    flickr: {
        apiKey: "4db07c97a4027d6a3c5536dd27c37ec9"
    }
};

/**
 * Application ViewModel
 */
var AppViewModel = function() {
    var self = this;

    // template uses 'id' attribute as only one infoWindow is used for this application's uses
    var infoWindowTemplateStr = '<div class="infoWindowContent">' +
    '<div id="locationTitle" class="infoWindowTitle"></div>' +
    '<div id="locationPhotos"></div>' +
    '<div id="locationDetails"></div>' +
    '<div class="infoWindowAttribution">Images provided by Flickr</div>' +
    '<div class="infoWindowAttribution">Information provided by Wikipedia</div>' +
    '</div';

    this.markers = [];
    this.lastClickedMarker = null;
    this.searchResults = ko.observableArray();
    this.searchKey = ko.observable("");


    this.initialize = function() {

        this.map = new google.maps.Map(document.getElementById('map'), mapDefaults);

        // Keep map center same when window is resized
        // via: https://stackoverflow.com/questions/8792676/center-google-maps-v3-on-browser-resize-responsive
        google.maps.event.addDomListener(window, "resize", function() {
            var currentCenter = self.map.getCenter();
            google.maps.event.trigger(self.map, "resize");
            self.map.setCenter(currentCenter);
        });

        this.infoWindow = new google.maps.InfoWindow({content: "" });

        // Stop previously selected marker's animation when infoWindow close button clicked
        this.infoWindow.addListener('closeclick', function() {
            if (self.lastClickedMarker != null) {
                self.lastClickedMarker.setAnimation(null);
            }
        });

        // Create array of marker objects using marker data
        for (var i = 0; i < markerListData.length; i++) {
            var marker = new google.maps.Marker({
                position: markerListData[i],
                map: this.map,
                title: markerListData[i].title
            });

            // set additional data on marker objects
            marker.address = markerListData[i].address;
            marker.wikiPageId = markerListData[i].wikiPageId;

            marker.addListener('click', function(markerItem) {

                return function() {

                    self.markerItemSelected(markerItem);
                }
            }(marker));

            this.markers.push(marker);          // add new marker to markers array
            this.searchResults.push(marker);    // prepopulate search result with all markers as default
            this.fetchMarkerContent(marker);
        }
    };

    this.resetMapPosition = function() {

        this.map.setCenter(mapDefaults.center);
        this.map.setZoom(mapDefaults.zoom);
    };

    // Retrieve 3rd party location data to show in infowindow when marker selected
    this.fetchMarkerContent = function(marker) {

        // Show loading icons in infoWindow while 3rd party data is being loaded
        marker.$content = $("<div/>");
        marker.$content.html(infoWindowTemplateStr);
        marker.$content.find('#locationTitle').html(marker.title);
        marker.$content.find('#locationPhotos').html("<img class='loadingIcon' src='images/loadingicon.gif' height='20' width='20'>");
        marker.$content.find('#locationDetails').html("<img class='loadingIcon' src='images/loadingicon.gif' height='20' width='20'>");
        self.setInfoWindowContent(marker);

        // Fetch 3rd party content
        self.fetchFlickrContent(marker);
        self.fetchWikiContent(marker);
    };

    this.fetchFlickrContent = function(marker) {

        // Flickr Photos AJAX Request
        var maxPhotoCount = 3;
        var perPageCount = (maxPhotoCount > 500) ? 500 : maxPhotoCount;
        var flickrUrl = "https://api.flickr.com/services/rest/";

        $.ajax(flickrUrl, {
            timeout: 8000,
            cache: true,
            dataType: "json",
            data: {
                method: 'flickr.photos.search',
                api_key: apiCredentials.flickr.apiKey,
                format: 'json',
                nojsoncallback: '1',
                content_type: '1',
                per_page: perPageCount,
                sort: 'relevance',                  // additional parameters to improve photo relevance
                lat: marker.getPosition().lat(),
                lon: marker.getPosition().lng(),
                text: marker.title
            },
            success: function(data) {

                var contentStr = "";
                var $locationPhotos = marker.$content.find("#locationPhotos");

                // Check if Flickr data could not be retrieved for marker
                if ((data.stat !== "ok") || (data.photos == null) || (data.photos.photo == null)) {
                    var errorStr = "Error: request succeeded but failed to retrieve Flickr data!";

                    if ((data.stat === "fail") && (data.code != null))  {
                        errorStr += "\n(Error code: " + data.code;
                        if (data.message != null) {
                            errorStr += ", message: '" + data.message + "'";
                        }
                        errorStr += ")";
                    }

                    console.log(errorStr);
                    contentStr = "Failed to retrieve location photos";
                    $locationPhotos.addClass('loadingError');
                } else {
                    // Retrieve photo data for marker
                    for (var i = 0; i < data.photos.photo.length; i++) {
                        var photoItem = data.photos.photo[i];

                        // create photo url and add img element for each photo
                        var imgSrc = "https://farm" + photoItem.farm + ".staticflickr.com/" + photoItem.server + "/" + photoItem.id + "_" + photoItem.secret + ".jpg";
                        contentStr += "<a href='" + imgSrc + "'>";
                        contentStr += "<img class='infoWindowPhoto' src=" + imgSrc + "'>";
                        contentStr += "</a>";
                    }
                    $locationPhotos.addClass("infoWindowPhotos");
                }

                $locationPhotos.html(contentStr);
                self.setInfoWindowContent(marker);
            }
        })
        .fail(function(rqs, statusStr, errStr) {

            // Update marker content with data retrieval failed status
            var errorStr = "Error: failed to retrieve Flickr data! Request failed.";
            if (statusStr != null) {
                errorStr += "\n(status: '" + statusStr + "'";

                if (errStr != null && errStr !== '') {
                    errorStr += ": '" + errStr + "'";
                }
                errorStr += ")";
            }

            console.log(errorStr);
            var $locationPhotos = marker.$content.find("#locationPhotos");
            $locationPhotos.html("Failed to retrieve location photos");
            $locationPhotos.addClass('loadingError');
            self.setInfoWindowContent(marker);
        });
    };

    this.fetchWikiContent = function(marker) {

        // Wikipedia AJAX Request
        var wikiUrl = "https://en.wikipedia.org/w/api.php";

        $.ajax(wikiUrl, {
            timeout: 8000,
            cache: true,
            dataType: "jsonp",
            data: {
                action: 'query',
                format: 'json',
                formatversion: 2,
                prop: 'extracts',
                exintro: '',
                pageids: marker.wikiPageId,
                redirects: ''
            },
            success: function(data) {

                var contentStr = "";
                var $locationDetails = marker.$content.find("#locationDetails");

                if ((data.query == null) || (data.query.pages == null)) {
                    var errorStr = "Error: failed to retrieve Wikipedia data!";
                    if (data.error != null) {
                        errorStr += "\n(Error code: " + data.error.code;
                        if (data.error.info !== '') {
                            errorStr += ", message: '" + data.error.info + "'";
                        }
                        errorStr += ")";
                    }

                    console.log(errorStr);
                    contentStr = "Failed to retrieve location details";
                    $locationDetails.addClass('loadingError');
                } else {
                    // Retrieve wiki summary data for marker
                    for (var i = 0; i < data.query.pages.length; i++) {

                        if(data.query.pages[i].pageid === marker.wikiPageId) {
                            var firstPTag = $("<div/>").html(data.query.pages[i].extract).find("p").get(0);

                            if (typeof(firstPTag) !== "undefined") {
                                contentStr += "<p>";
                                // extract first <p> tag from wiki data for infoWindow content
                                contentStr += firstPTag.innerHTML;
                                contentStr += " <a href='" + encodeURI("https://en.wikipedia.org/wiki/" + data.query.pages[i].title) + "'>Read more...</a>";
                                contentStr += "</p>";
                            }
                            break;
                        }
                    }
                    $locationDetails.addClass("infoWindowDetails");
                }

                $locationDetails.html(contentStr);
                self.setInfoWindowContent(marker);
            }
        })
        .fail(function(rqs, statusStr, errStr) {

            // Update marker content with data retrieval failed status
            var errorStr = "Error: failed to retrieve Wikipedia data! Request failed.";
            if (statusStr != null) {
                errorStr += "\n(status: '" + statusStr + "'";

                if (errStr != null && errStr !== '') {
                    errorStr += ": '" + errStr + "'";
                }
                errorStr += ")";
            }

            console.log(errorStr);
            var $locationDetails = marker.$content.find('#locationDetails');
            $locationDetails.html("Failed to retrieve location details");
            $locationDetails.addClass('loadingError');
            self.setInfoWindowContent(marker);
        });
    };

    this.markerItemSelected = function(marker) {

        self.infoWindow.setContent("");             // clear infoWindow content before opening
        self.map.panTo(marker.getPosition());
        self.infoWindow.open(self.map, marker);

        // Stop previously selected marker's animation when new marker selected
        if (self.lastClickedMarker != null && self.lastClickedMarker !== marker) {
            self.lastClickedMarker.setAnimation(null);
        }
        marker.setAnimation(google.maps.Animation.BOUNCE);
        self.lastClickedMarker = marker;

        if (marker.$content == null) {
            self.fetchMarkerContent(marker);
        }

        self.setInfoWindowContent(marker);
    };

    this.searchForMarker = function() {

        var results = [];
        for(var i = 0; i < this.markers.length; i++) {
            var markerInfo = (this.markers[i].title + " " + this.markers[i].address).trim().toLowerCase();

            if (markerInfo.indexOf(this.searchKey().trim().toLowerCase()) !== -1) {
                if (this.markers[i].getMap() !== this.map) {
                    this.markers[i].setMap(this.map);
                }
                results.push(this.markers[i]);
            }
            else {
                if (this.infoWindow.getPosition() === this.markers[i].position) {
                    this.infoWindow.close();    // make sure info window is closed when marker is removed from map
                }

                this.markers[i].setMap(null);     // remove markers from map that are filtered out
            }
        }

        this.searchResults(results);
    };

    this.setInfoWindowContent = function(marker) {

        if (self.infoWindow.getPosition() === marker.position) {
            // only set info window content with content of marker at info window's current position
            self.infoWindow.setContent(marker.$content.html());
        }
    };
};

/**
 * Application Launch
 */
var launchApp = function() {

    var viewModel = new AppViewModel();
    viewModel.initialize();
    ko.applyBindings(viewModel);
};
