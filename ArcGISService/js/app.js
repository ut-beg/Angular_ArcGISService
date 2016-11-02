var arcGISServiceDemoAppModule = angular.module('arcGISServiceDemoApp', [
    'localStorageServiceModule',
    'arcGISServiceModule'
])
.config([
function () {

}])
.run(function (ArcGISService) {

        //Configure the service with the REST API URL you intend to use.  This can't be done in the "config" method because
        //services don't actually get instantiated until after that.
        var restApiUrl = "http://coastal.beg.utexas.edu:6080/arcgis/rest/services/SampleWorldCities";

        ArcGISService.setBaseRestApiUrl(restApiUrl);
    }
)
.controller('ArcGISServiceDemoController', ["$scope", "ArcGISService",
    function ($scope, ArcGISService) {
        $scope.serviceData = null;

        $scope.selectedLayerDetails = null;

        $scope.stateVars = {
            queryValue: null
        };

        $scope.queryResult = null;

        $scope.doLayerQuery = function (field) {

            var whereClause;

            var needQuotesTypes = ["esriFieldTypeString"];

            //Check if our field is of a type that requires quotes, and compose the appropriate where clause.
            if(needQuotesTypes.indexOf(field.type) >= 0)
            {
                whereClause = field.name + "= '" + $scope.stateVars.queryValue + "'";
            }
            else
            {
                whereClause = field.name + "=" + $scope.stateVars.queryValue;
            }
            
            //Execute the query.  The two null arguments are the geometric filter in GeoJSON format and the order by list, respectively.
            ArcGISService.queryFeatureClass($scope.selectedLayerDetails.id, whereClause, null, null).then(
                function (result) {
                    $scope.queryResult = result;
                });
                
        };
        
        $scope.showLayerDetails = function (layer) {
            //Example of a request that retrieves the details information about a layer in the service.  Note that this works on tables as well.
            ArcGISService.getFeatureClassDetails(layer.id).then(
                function (result) {
                    $scope.selectedLayerDetails = result;
                });
        };

        //Example of a query that retrieves the set of layers in the service.
        ArcGISService.getServiceMetadata().then(function (result) {
            $scope.serviceData = result;
        });
    }
]);
