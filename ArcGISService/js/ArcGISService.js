// ArcGISService.js
// Bureau of Economic Geology - The University of Texas at Austin
// 2016-11-02
// Aaron Averett
// This is an Angular module that provides a convenient promise API wrapper around the ArcGIS REST API.
//
// Subject to MIT license - see LICENSE file included in the GitHub Repo


var arcGISServiceModule = angular.module('arcGISServiceModule', ['localStorageServiceModule'])
.factory('ArcGISService', ['$q', '$http', '$window', 'LocalStorageService',
    function ($q, $http, $window, LocalStorage) {
        this._userInfo = null;

        this._featureClassData = {};
        this._serviceMetadata = null; 
               
        var storedApplicationData = LocalStorage('continuum', 'applicationData');
        if (storedApplicationData.get('userInfo') != null)
        {
            this._userInfo = storedApplicationData.get('userInfo');
        }


        var _this = this; //Note use of _this.  Unless we use bind, the meaning of "this" is not guaranteed to be our desired instance.  Because
        //we're operating within a closure, however, we can specify "_this" and that's guaranteed to be our service object instance.

        //We support two separate services, in case we have a situation where one is supposed to be read only, and the other allows editing.
        _this.baseRestApiUrl = null;
        _this.editableRestApiUrl = null;

        _this.setBaseRestApiUrl = function (url) {
            if (url != null && url != undefined && url.length != undefined)
            {
                if (url[url.length - 1] != "/")
                {
                    url += "/";
                }
            }

            _this.baseRestApiUrl = url;
        };

        _this.setEditableRestApiUrl = function (url) {
            if (url != null && url != undefined && url.length != undefined) {
                if (url[url.length - 1] != "/") {
                    url += "/";
                }
            }

            _this.editableRestApiUrl = url;
        };

        this.setUserInfoDefaults = function()
        {
            this._userInfo = {
                authToken: null,
                authTokenExpires: 0,
                username: null,
                password: null,
                isAuthenticated: false
            };

            storedApplicationData.set('userInfo', this._userInfo);
        };

        //Set the user info.
        if (this._userInfo == null)
        {
            this.setUserInfoDefaults();
        }

        this.authenticateWithUserCredentials = function (username, password) {
            var deferred = $q.defer();
            //Set our credentials to the ones provided.
            _this._userInfo.username = username;
            _this._userInfo.password = password;

            _this.requestAuthToken().then(function () {
                //If we succeeded in authenticating with the given username/password, flag us as 
                _this._userInfo.isAuthenticated = true;
                deferred.resolve();
            });

            return deferred.promise;
        };

        //Clears out the authentication data.
        this.logout = function () {
            _this.setUserInfoDefaults();
        };

        //Requests an authorization token from the server.
        this.requestAuthToken = function () {

            var deferred = $q.defer();

            //Do we have a username and a password?
            if (_this._userInfo.username != undefined &&
                _this._userInfo.username != null &&
                _this._userInfo.username != "" &&
                _this._userInfo.password != undefined &&
                _this._userInfo.password != null &&
                _this._userInfo.password != "") {



                var reqUrl = arcGISServiceModule.tokenAuthenticationURL;

                var reqData = {
                    username: _this._userInfo.username,
                    password: _this._userInfo.password,
                    f: 'json'
                };

                reqData = arcGISServiceModule.composeQueryString(reqData);

                $http({
                    method: 'POST',
                    url: reqUrl,
                    data: reqData,
                    headers: {
                        'Content-type': " application/x-www-form-urlencoded"
                    }
                }).success(function (data) {
                    var result = false;

                    if (data.error != undefined && data.error.code == 200 && data.error.details == "Invalid credentials") {
                        _this.setUserInfoDefaults(); //The user failed to login.  Clear out a
                    }
                    else {

                        try {
                            _this._userInfo.authToken = data.token;
                            _this._userInfo.authTokenExpires = data.expires;
                            _this._userInfo.isAuthenticated = true;

                            //update the stored application data.
                            storedApplicationData.set('userInfo', _this._userInfo);
                        }
                        catch (ex) {

                        }
                    }

                    deferred.resolve();
                }).error(function (error) {
                    deferred.reject();
                });
            }
            else
            {
                deferred.resolve();
            }

            return deferred.promise;
        };

        this.getCurrentServiceBaseAddress = function () {
            var baseURL = _this.baseRestApiUrl;

            if (_this._userInfo.isAuthenticated) {
                baseURL = arcGISServiceModule.editableRestApiUrl;
            }

            return baseURL;
        };

        //Retrieves the metadata for the configured layers in the service.
        this.getFeatureClasses = function()
        {
            var routeComponents = ["MapServer"];

            var deferred = $q.defer();

            _this.getBasicParameters().then(function (params) {

                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });
            });

            return deferred.promise;
        };

        this.getServiceMetadata = function () {
            var deferred = $q.defer();


            if (_this._serviceMetadata != null) {
                deferred.resolve(_this._serviceMetadata);
            }
            else {
                var routeComponents = ["MapServer"];

                _this.getBasicParameters().then(function (params) {
                    _this.doServiceRequest(routeComponents, params).then(function (serviceMetadata) {

                        _this._serviceMetadata = serviceMetadata;

                        deferred.resolve(_this._serviceMetadata);
                    });
                });
            }
            

            return deferred.promise;
        };

        this.getLeafletOverlayProperties = function () {
            
        };

        this.getLegendData = function () {
            var deferred = $q.defer();

            var routeComponents = ["MapServer", "legend"];

            _this.getBasicParameters().then(function (params) {
                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });
            });

            return deferred.promise;
        };

        //Gets detailed information about the specified feature class.
        this.getFeatureClassDetails = function(featureClassID)
        {
            var deferred = $q.defer();

            var routeComponents = ["MapServer", featureClassID];

            if (_this._featureClassData[featureClassID] != null && _this._featureClassData != undefined) {
                deferred.resolve(_this._featureClassData[featureClassID]);
            }
            else {
                _this.getBasicParameters().then(function (params) {
                    _this.doServiceRequest(routeComponents, params).then(function (data) {
                        _this._featureClassData[featureClassID] = data;
                        deferred.resolve(data);
                    });
                });
            }
            
            return deferred.promise;
        };

        //Retrieves the data for a single feature, by ID.
        this.getFeatureDetails = function(featureClassID, featureID)
        {
            var deferred = $q.defer();

            _this.getBasicParameters().then(function (params) {

                var capabilityName = "MapServer";
                if (params.token != undefined && params.token != null && params.token != "")
                {
                    capabilityName = "FeatureServer";
                }

                var routeComponents = [capabilityName, featureClassID, featureID];
               
                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });
            });

            return deferred.promise;
        };

        //
        this.getRelatedItemData = function (relationship, featureClassID, featureID) {
            var deferred = $q.defer();

            _this.getBasicParameters().then(function (params) {
                
                var routeComponents = ["MapServer", featureClassID.toString(), "queryRelatedRecords"];

                //Set the parameters
                params.objectIds = featureID.toString();
                params.relationshipId = relationship.id;
                params.returnGeometry = "true";
                params.outFields = "*";
                

                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });

            });

            return deferred.promise;
        };

        //Deletes the given feature from the given feature class.
        this.deleteFeature = function(featureClassID, featureID)
        {
            var deferred = $q.defer();
            
            var routeComponents = ["FeatureServer", "applyEdits"];

            _this.getBasicParameters().then(function (parameters) {
                parameters.edits = [{
                    "id": featureClassID,
                    "deletes": [featureID]
                }];

                _this.doServiceRequest(routeComponents, parameters).then(function (data) {
                    deferred.resolve(_this.checkDeleteSuccess(featureClassID, data));
                });
            });

            return deferred.promise;
        };

        this.checkDeleteSuccess = function (featureClassID, deleteResponseData) {
            var success = false;

            for (var i = 0; i < deleteResponseData.length; i++) {
                if (deleteResponseData[i].id == featureClassID) {
                    var deleteResults = deleteResponseData[i].deleteResults;

                    if (deleteResults[0].success == true) {
                        success = deleteResults[0].success;
                        break;
                    }
                }
            }

            return success;
        };

        //Submits the given feature data to the feature service for updating.
        this.editFeature = function(featureClassID, featureData){
            var deferred = $q.defer();

            //Make sure the user didn't empty out all the fields.
            if (_this.notAllBlank(featureData))
            {
                var routeComponents = ["FeatureServer", "applyEdits"];

                _this.getBasicParameters().then(function (parameters) {
                    _this.prepareFeatureDataForSubmission(featureData, featureClassID).then(function (arcgisFeatureData) {
                        parameters.edits = [{
                            "id": featureClassID,
                            "updates": [arcgisFeatureData]
                        }];

                        _this.doServiceRequest(routeComponents, parameters).then(function(data)
                        {
                            deferred.resolve(_this.checkUpdateSuccess(featureClassID, data));
                        });
                    });
                });
            }
            else
            {
                deferred.resolve(false);
            }

            return deferred.promise;
        };

        this.insertFeature = function (featureClassID, featureData) {
            var deferred = $q.defer();

            if (_this.notAllBlank(featureData)) {
                var routeComponents = ["FeatureServer", "applyEdits"];

                _this.getBasicParameters().then(function (parameters) {
                    _this.prepareFeatureDataForSubmission(featureData, featureClassID, true).then(function (arcgisFeatureData) {
                        parameters.edits = [{
                            "id": featureClassID,
                            "adds": [arcgisFeatureData]
                        }];

                        _this.doServiceRequest(routeComponents, parameters).then(function (data) {
                            deferred.resolve(_this.checkInsertSuccess(featureClassID, data));
                        });
                    });
                });
            }
            else
            {
                deferred.resolve(null);
            }

            return deferred.promise;
        };

        this.checkInsertSuccess = function (featureClassID, insertReturnData) {
            var newFeatureID = null;

            for (var i = 0; i < insertReturnData.length; i++) {
                if (insertReturnData[i].id == featureClassID) {
                    var insertResults = insertReturnData[i].addResults;

                    if (insertResults[0].success == true) {
                        newFeatureID = insertResults[0].objectId;
                        break;
                    }
                }
            }

            return newFeatureID;
        };

        this.checkUpdateSuccess = function (featureClassID, updateReturnData) {
            var success = true;

            for (var i = 0; i < updateReturnData.length; i++)
            {
                if(updateReturnData[i].id == featureClassID)
                {
                    var updateResults = updateReturnData[i].updateResults;

                    for(var j=0; j < updateResults.length; j++)
                    {
                        if(updateResults[j].success == false)
                        {
                            success = false;
                            break;
                        }
                    }

                    break;
                }
            }

            return success;
        };

        this.notAllBlank = function(featureData)
        {
            var notAllBlank = false;

            var keys = Object.keys(featureData);

            for (var i = 0; i < keys.length; i++)
            {
                if(featureData[keys[i]] != undefined && featureData[keys[i]] != null && featureData[keys[i]] != "")
                {
                    notAllBlank = true;
                    break; //All we really need here is one...
                }
            }

            return notAllBlank;
        }

        this.prepareFeatureDataForSubmission = function (featureData, featureClassID, operationIsInsert) {
            var deferred = $q.defer();


            var submittableObject = {};

            _this.getFeatureClassDetails(featureClassID).then(function (featureClassData) {
                var geometryField = _this.getGeometryField(featureClassData);
                var pkField = _this.getPKField(featureClassData);

                //If we have a geometry field...
                if(geometryField != null)
                {
                    var geoJSON = featureData[geometryField.name];

                    if (geoJSON != undefined && geoJSON != null) {
                        var agsGeometry = Terraformer.ArcGIS.convert(geoJSON, { idAttribute: "OBJECTID" });

                        submittableObject.geometry = agsGeometry;
                    }
                }

                submittableObject.attributes = {};

                for(var i=0; i < featureClassData.fields.length; i++)
                {
                    var field = featureClassData.fields[i];
                    
                    //We don't do this to the geometry field, but we DO do it to everything else.
                    if(field.type != 'esriFieldTypeGeometry')
                    {
                        submittableObject.attributes[field.name] = _this.prepareFeatureDataValueForSubmission(featureData[field.name], field);
                    }
                }

                deferred.resolve(submittableObject);
                
            });

            return deferred.promise;
        };

        this.prepareFeatureDataValueForSubmission = function (value, field) {
            
            var ret = null;

            if (field.type == "esriFieldTypeDate" && typeof value == "object")
            {
                try
                {
                    ret = value.getTime();
                }
                catch(ex)
                {
                    ret = value;
                }
            }
            else if(value != undefined) //I don't think we want to explicitly pass "undefined" to the server, although I think null is acceptable.
            {
                ret = value;
            }

            return ret;

        };

        //Executes a query against a layer or table in a map service.
        this.queryFeatureClass = function(featureClassID, whereClause, filterGeometry, orderByFields)
        {
            var deferred = $q.defer();

            //var route = "/" + featureClassID + "/query";
            var routeComponents = ["MapServer", featureClassID, "query"];
            var route = arcGISServiceModule.composeRouteString(routeComponents);

            _this.getBasicParameters().then(function (params) {

                if (whereClause == undefined || whereClause == null || whereClause == "") {
                    whereClause = "1=1";
                }

                var esriFilterGeometry = null;
                var esriGeometryType = null;

                if (filterGeometry != undefined && filterGeometry != null) {

                    var ags = Terraformer.ArcGIS.convert(filterGeometry, { idAttribute: "OBJECTID" });

                    esriFilterGeometry = ags.geometry;

                    var geomJSON = JSON.stringify(esriFilterGeometry);

                    if (filterGeometry.geometry.type == "Polygon") {
                        esriGeometryType = "esriGeometryPolygon";
                    }
                    else if (filterGeometry.geometry.type == "Point") {
                        esriGeometryType = "esriGeometryPoint";
                    }
                }

                params.where = whereClause;
                params.outFields = "*";

                //If we have filter geometry, add it to the query
                if (esriFilterGeometry != null) {
                    params.geometry = esriFilterGeometry;
                    params.geometryType = esriGeometryType;

                    //Unset the geometry's spatial reference
                    delete params.geometry.spatialReference;
                }

                if(orderByFields != undefined && orderByFields != null)
                {
                    params.orderByFields = orderByFields;
                }

                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });
            });

            return deferred.promise;
        };

        //Runs an async query against the service and fetches just the unique values that match "stub".
        this.queryForAutoComplete = function (featureClassID, fieldName, stub) {
            var deferred = $q.defer();

            //var route = "/" + featureClassID + "/query";
            var routeComponents = ["MapServer", featureClassID, "query"];
            var route = arcGISServiceModule.composeRouteString(routeComponents);

            _this.getBasicParameters().then(function (params) {

                var whereClause = fieldName + " LIKE '" + stub + "%'";

                params.where = whereClause;
                params.outFields = fieldName;
                params.returnDistinctValues = true; //Return distinct values.
                params.returnGeometry = false; //Don't return geometry, as some database types don't support this and distinct at the same time.

                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });
            });

            return deferred.promise;
        };

        this.getPKField = function (featureClass) {
            var ret = null;

            for (var i = 0; i < featureClass.fields.length; i++) {
                if (featureClass.fields[i].type == "esriFieldTypeOID") {
                    ret = featureClass.fields[i];
                    break;
                }
            }

            return ret;
        };

        this.extractFeatureDataFromFeatureResponse = function(data, geometryType, spatialReference) {
            var f = data.feature;

            var obj = null;

            if(f != undefined && f != null)
            {
                var obj = f.attributes;

                obj.SHAPE = arcGISServiceModule.convertToGeoJSON(f.geometry, geometryType, spatialReference);

                //For some reason, the server doesn't like the -180 to 180 coordinates.  We need to adjust the coordinates so that our client can handle this.
                arcGISServiceModule.rectifyXCoords(obj.SHAPE);
            }

            return obj;
        };

        this.extractFeatureDataFromQueryResponse = function (responseData) {

            //parse the JSON
            var dsData = angular.fromJson(responseData);

            //Handle the peculiarities of an ArcGIS REST API json response
            var restResponse = dsData;

            var ret = null;

            if (restResponse != null) {
                ret = new Array();

                for (var i = 0; i < restResponse.features.length; i++) {
                    var obj = restResponse.features[i].attributes;

                    if (restResponse.features[i].geometry != undefined) {
                        //Convert the geometry to GeoJSON and add it to the object.
                        obj.SHAPE = arcGISServiceModule.convertToGeoJSON(restResponse.features[i].geometry, restResponse.geometryType, restResponse.spatialReference);

                        //For some reason, the server doesn't like the -180 to 180 coordinates.  We need to adjust the coordinates so that our client can handle this.
                        arcGISServiceModule.rectifyXCoords(obj.SHAPE);
                    }

                    ret.push(obj);
                }
                ret.push();
            }

            return ret;
        };

        //Gets a count of the number of features in the given set.
        this.getTotalFeatureCount = function (featureClassID, whereClause, filterGeometry) {

            var deferred = $q.defer();

            _this.getBasicParameters().then(function (params) {
                var routeComponents = ["MapServer", featureClassID, "query"];

                if (whereClause == undefined || whereClause == null || whereClause == "") {
                    whereClause = "1=1";
                }

                var esriFilterGeometry = null;
                var esriGeometryType = null;

                if (filterGeometry != undefined && filterGeometry != null) {
                    var ags = Terraformer.ArcGIS.convert(filterGeometry, { idAttribute: "OBJECTID" });

                    esriFilterGeometry = ags.geometry;

                    if (filterGeometry.geometry.type == "Polygon") {
                        esriGeometryType = "esriGeometryPolygon";
                    }
                }

                params.where = whereClause;
                params.outFields = "*";
                params.returnCountOnly = true;

                _this.doServiceRequest(routeComponents, params).then(function (data) {
                    deferred.resolve(data);
                });
            });

            return deferred.promise;
        };

        //Produces a parameter object ready for post or get access to the service.  Additional parameters can be added to the object to specify the details of query.
        this.getBasicParameters = function () {

            var deferred = $q.defer();

            var params = {
                f: "json"
            };

            //Request the authorization token from the service.
            _this.getAuthToken().then(function (token) {

                //The token can be null for a variety of reasons, but why doesn't really matter so much - bottom line here is that we just don't have one.
                if (token != null) {
                    params.token = token;
                }

                deferred.resolve(params);
            });

            return deferred.promise;
        };

        //Accessor for the fairly complex process of fetching the authorization token from the service.
        this.getAuthToken = function () {
            var deferred = $q.defer();

            if (_this._userInfo.authToken != null && !_this.authTokenIsExpired())
            {
                //If we already have the auth token, go ahead and resolve the promise.
                deferred.resolve(_this._userInfo.authToken);
            }
            else
            {
                //If we don't already have the auth token, we need to request it from the server.
                _this.requestAuthToken().then(function (data) {
                    deferred.resolve(_this._userInfo.authToken);
                });
            }

            return deferred.promise;
        };

        //Checks whether our authorization token is expired.
        this.authTokenIsExpired = function () {
            var ret = false;

            var now = new Date().getTime();
            if(_this._userInfo.authToken != null && _this._userInfo.authTokenExpires < now)
            {
                ret = true;
            }

            return ret;
        };

        //This executes a request against the service as a deferred promise, using the POST verb
        this.doServiceRequest = function (routeComponents, params) {
            var deferred = $q.defer();

            var route = arcGISServiceModule.composeRouteString(routeComponents);

            var baseURL = _this.getCurrentServiceBaseAddress();

            var reqUrl = baseURL + route;

            var queryString = arcGISServiceModule.composeQueryString(params);

            $http({
                method: 'POST',
                url: reqUrl,
                data: queryString,
                headers: {
                    'Content-type': 'application/x-www-form-urlencoded'
                }
            }).success(function (data) {
                deferred.resolve(data);
            }).error(function (data) {
                deferred.reject();
            });

            return deferred.promise;
        };

        //Retrieves the user data from the service.
        this.getUserInfo = function () {
            return _this._userInfo;
        };

        this.setUserInfo = function (newUserInfo) {
            _this._userInfo = newUserInfo;
        };

        this.loginUser = function () {
            return this.getAuthToken();
        };

        this.getGeometryField = function (featureClassData) {
            var ret = null;

            for (var i = 0; i < featureClassData.fields.length; i++)
            {
                var field = featureClassData.fields[i];

                if(field.type == "esriFieldTypeGeometry")
                {
                    ret = field;
                    break;
                }
            }

            return ret;
        };

        //There are quite a few circumstances where we might want to override
        this.getOverrideData = function (layerID) {
            var deferred = $q.defer();

            var reqUrl = "http://coastal.beg.utexas.edu/continuum2/JSON/OverrideData/override_" + layerID + ".json";

            //Load up the override file for this feature class.
            $http({
                method: 'GET',
                url: reqUrl
            }).success(function (data) {

                //Hunts for the given field's data in the override data
                data.getField = function (fieldName) {
                    var ret = null;

                    if(data.fields != undefined && data.fields != null)
                    {
                        for(var i=0; i < data.fields.length; i++)
                        {
                            if(data.fields[i].name == fieldName)
                            {
                                ret = data.fields[i];
                                break;
                            }
                        }
                    }

                    return ret;
                };

                deferred.resolve(data);
            }).error(function (data) {
                console.log(reqUrl);
                deferred.reject();
            });

            return deferred.promise;
        };

        this.getPreviewImageUrl = function (fieldInfo, layerInfo, featureInfo) {
            var deferred = $q.defer();

            var keyFieldName = layerInfo.keyField;
            var oidFieldInfo = null;
            for(var i=0; layerInfo.relatedRecordData.fields.length; i++)
            {
                if(layerInfo.relatedRecordData.fields[i].name == keyFieldName)
                {
                    oidFieldInfo = layerInfo.relatedRecordData.fields[i];
                    break;
                }
            }
            
            //= $scope.findObjectIDField();

            var url = "";

            if (featureInfo != null) {
                url = "RequestAsset.aspx?";
                url += "objectId=" +featureInfo.attributes[oidFieldInfo.name];
                url += "&";
                url += "layerId=" + layerInfo.id;
                url += "&";
                url += "field=" + fieldInfo.name;
                url += "&";

                _this.getAuthToken().then(function (token) {
                    if (token != null) {
                        url += "&token=" + token;
                    }

                    url += "&serviceAddr=" + encodeURIComponent(_this.getCurrentServiceBaseAddress());

                    var urls = {
                        thumbnailUrl: url + "&mode=3",
                        headerUrl: url + "&mode=2",
                        fullUrl: url + "&mode=0"
                    };

                    deferred.resolve(urls);
                });
            }

            return deferred.promise;
        };

        return this;
    }
]);

//This turns the object passed in into a set of query string parameters that can be added to a REST URL
arcGISServiceModule.composeQueryString = function (parameters) {
    var queryString = "";

    for (var propertyName in parameters) {
        //If it's an object, turn it into JSON first.
        var value = parameters[propertyName];

        if (value != undefined && value != null) {

            if (queryString != "") {
                queryString += "&";
            }

            if (typeof value === 'object' || typeof value === 'array') {
                var json = angular.toJson(value);
                value = json;
            }

            queryString += propertyName + "=" + encodeURIComponent(value);
        }
    }

    return queryString;
};

arcGISServiceModule.composeRouteString = function(routeComponents)
{
    var routeString = "";

    if(routeComponents != undefined && routeComponents != null)
    {
        for(var i=0; i < routeComponents.length; i++)
        {
            routeString += routeComponents[i];

            if(i + 1 < routeComponents.length)
            {
                routeString += "/";
            }
        }
    }

    return routeString;
};

arcGISServiceModule.composeFullURL = function(routeComponents, queryParams)
{
    var queryString = arcGISServiceModule.composeQueryString(queryParams);
    var route = arcGISServiceModule.composeRouteString(routeComponents);

    if (queryString != "")
    {
        queryString = "?" + queryString;
    }

    if (route != "" && arcGISServiceModule.baseRestApiUrl[arcGISServiceModule.baseRestApiUrl.length - 1] != "/")
    {
        route = "/" + route;
    }

    var reqUrl = arcGISServiceModule.baseRestApiUrl + route + queryString;
    
    return reqUrl;
}

arcGISServiceModule.convertToGeoJSON = function (geometry, geometryType, spatialReference) {
    var ret = null;

    if (geometry != null && geometry != undefined) {
        ret = Terraformer.ArcGIS.parse(geometry, spatialReference);
    }
    return ret;
};

arcGISServiceModule.unrectifyXCoords = function (geometry) {
    if (geometry.type == "Point") {
        arcGISServiceModule.unrectifyXCoordsPoint(geometry);
    }
    else if(geometry.type == "Polygon")
    {
        arcGISServiceModule.unrectifyXCoordsPolygon(geometry);
    }
};

arcGISServiceModule.unrectifyXCoordsPoint = function (geometry) {
    if (geometry.type == "Point") {
        if (geometry.coordinates[0] < 0) {
            geometry.coordinates[0] = geometry.coordinates[0] + 360;
        }
    }
};

arcGISServiceModule.unrectifyXCoordsPolygon = function (geometry) {
    var rings = geometry.coordinates;

    for(var i=0; i < rings.length; i++)
    {
        for (var j = 0; j < rings[i].length; j++)
        {
            if(rings[i][j][0] < 0)
            {
                rings[i][j][0] = rings[i][j][0] + 360;
            }
        }
    }
};

arcGISServiceModule.rectifyXCoords = function (geometry) {
    if(geometry.type == "Point")
    {
        arcGISServiceModule.rectifyXCoordsPoint(geometry);
    }
    else {
        //Eventually, we'll probably need to implement the line and polygon features.
    }
};

arcGISServiceModule.rectifyXCoordsPoint = function (geometry) {
    if (geometry.type == "Point") {
        if (geometry.coordinates[0] > 180) {
            geometry.coordinates[0] = geometry.coordinates[0] - 360;
        }
    }
};