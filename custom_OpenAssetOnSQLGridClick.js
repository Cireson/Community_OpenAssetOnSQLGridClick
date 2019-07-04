/* ----------------------------------------------- */
/* --------- Open Asset on SQL Grid Click -------- */
/* ----------------------------------------------- */
// v9.3.4.v1
// Contributors: Joivan
// Description: If a dashboard grid view has a column that contains the name "BaseManagedEntityId", and that column has the Entity ID, then this script makes the row clickable, 
//				going to the asset object (hardware, location, organization, etc) in a new tab.

var $gridColumnNameWithEntityId = null;
var $baseAssetUrlOnSqlClick = null;

$(document).ready(function () {

	var url = window.location.href;
	if(url.indexOf("/Page/") == -1 )
	{ 
		// Loosely verify we are on a page with workitems, not using hte GetProjection API call.
		return;
	}
	
	var mainPageNode = document.getElementById('main_wrapper');
	
	// create an observer instance
	var observer = new MutationObserver(function(mutations) {
		
		var titleElement = $("h1.ng-binding"); //The title "usually" exists. But not on dashboard pages.
		var dashboardElement = $(".dashboard"); //The dashboard always exists for...pages with dashboards.
	
		if (titleElement.length == 0 || titleElement.html() == "") {
			return; //title hasn't loaded yet.
		}
		
		if (dashboardElement.length == 0) {
			//The dashboard element, although incomplete, loads at the same time as teh title. If it exists, then this is a dashboard page. If not, then it will never exist.
			observer.disconnect();
			return;
		}		

		//See if our table has data rows yet.
		var rows = $("tr[data-uid");
		if (rows.length == 0) {
			return;
		}
		
		var gridElement = $('[data-role=grid]'); // Get the grid div element
		var kendoGridElement = gridElement.getKendoGrid(); //...as a kendo widget
		if (kendoGridElement.columns.length == 0) {
			return;
		}
		
		//We are done observing.
		observer.disconnect();
		
		var strThisScriptIdElement = "opensqlgridclick";
		if ($(strThisScriptIdElement).length > 0) {
			console.log("element '" + strThisScriptIdElement + "' already exists.");
			return;
		}
		
		gridElement.append("<span id=" + strThisScriptIdElement + " />");
		
		//We have table rows. 
		fnAddAssetClickEventToGrid();
			
	});
	
	
	function fnAddAssetClickEventToGrid() {
		UnbindDefaultGridClickBehavior();
		
		DetermineAssetUrlAndBindAnchors();
		
	}
	
	// configure the observer and start the instance.
	var observerConfig = { attributes: true, childList: true, subtree: true, characterData: true };
	observer.observe(mainPageNode, observerConfig);
	
	function UnbindDefaultGridClickBehavior() {
		var gridElement = $('[data-role=grid]'); // Get the grid div element
		var kendoGridElement = gridElement.getKendoGrid(); //...as a kendo widget
		var indexWithGuid = -1;
		
		//console.log("asdf3");
		
		for(var i = 0; i < kendoGridElement.columns.length; i++) {
		
			if ($gridColumnNameWithEntityId == null && kendoGridElement.columns[i].field.toUpperCase().indexOf("BASEMANAGEDENTITYID") > -1 ) { //as of 8.9.4, do this for the upper case bug. 
				indexWithGuid = i;
				$gridColumnNameWithEntityId = kendoGridElement.columns[i].field; //perhaps "HWA_BaseManagedEntityId" ? Or whatever the SQL named it.
				break;
			}
		}
		
		if (indexWithGuid < 0) {
			return null; //This grid doesn't have a BASEMANAGEDENTITYID column.
		}
		
		//hide this column by default.
		kendoGridElement.hideColumn(indexWithGuid)
		
		//Next, undo the change binding on this grid, on row select. By default, it will take us to a useless search page.
		kendoGridElement.unbind("change");
		
	}
	
	function DetermineAssetUrlAndBindAnchors() {
		
		var gridElement = $('[data-role=grid]'); // Get the grid div element
		var kendoGridElement = gridElement.getKendoGrid(); //...as a kendo widget
		
		var firstKendoDataItem = kendoGridElement.dataItem(gridElement.find("tr")[1])
		var strEntityId = firstKendoDataItem.BaseManagedEntityId;
		
		var strCriteria = {
			"Id": "8ab27adb-13b1-2b7b-56e6-91598417cbee", //System.ConfigItem.Projection
			"Criteria": {
				"Base": {
					"Expression": {
						"SimpleExpression": {
							"ValueExpressionLeft": {
								"GenericProperty": "Id"
							},
							"Operator": "Like",
							"ValueExpressionRight": {
								"Value": strEntityId
							}
						}
					}
				}
			}
		}
		
		// Stringify the criteria
		var jsonCriteria = JSON.stringify(strCriteria);	
		// Make the API call to grab the CR by guid
		$.ajax({
			type: "POST",
			url: "/api/V3/Projection/GetProjectionByCriteria", 
			contentType: 'application/json',
			dataType: 'json',			
			data: jsonCriteria,
			async: true,
			success: function (data) {
				//console.log(data);
				if (data.length === 1 && strEntityId != null && strEntityId.length > 0) {
					//Create the URL and open it in a new tab.
					var assetObject = data[0];
					var shortClassName = assetObject.ClassName.substring(assetObject.ClassName.lastIndexOf(".") + 1);
		
					$baseAssetUrlOnSqlClick = "/AssetManagement/" + shortClassName + "/Edit/"    //"/AssetManagement/HardwareAsset/Edit/" + strEntityId
					if (shortClassName != "HardwareAsset" && shortClassName != "SoftwareAsset") {
						$baseAssetUrlOnSqlClick = "/AssetManagement/Administration/" + shortClassName + "/Edit/"    //"/AssetManagement/Administration/Location/Edit/" + strEntityId
					}
					
					//Each row contains an a tag to a useless page. Remove it on datasource or page change.
					kendoGridElement.bind("dataBound", fnRemoveDefaultAnchorTagsFromGrid);
					kendoGridElement.bind("filter", fnRemoveDefaultAnchorTagsFromGrid);
					
					//And call it once for the current page.
					fnRemoveDefaultAnchorTagsFromGrid();
					
				}
				else{
					console.log("Unable to find object with ID '" + strEntityId + "'.");
				}
			}
		});
	}
	
	
	function fnRemoveDefaultAnchorTagsFromGrid(e) {
		
		var kendoGrid = null;
		var htmlElement = null;
		
		if (e == null) {
			var htmlElement = $('[data-role=grid]'); // Get the grid div element
			var kendoGrid = htmlElement.getKendoGrid(); //...as a kendo widget
		}
		else{
			var kendoGrid = e.sender;
			var htmlElement = kendoGrid.element;
		}
		
		var allHtmlAnchorsWithSearchUrl = htmlElement.find("tr:contains(a)").find("a[href^='/Search']")// .attr("href", "#");
		for(var i = 0; i < allHtmlAnchorsWithSearchUrl.length; i++) {
			//Update the a tag with the URL and baseId.
			var thisTr = allHtmlAnchorsWithSearchUrl[i].closest("tr");
			var thisKendoDataItem = kendoGrid.dataItem(thisTr);
			
			var strThisFinalUrl = $baseAssetUrlOnSqlClick + thisKendoDataItem.BaseManagedEntityId;
			allHtmlAnchorsWithSearchUrl.attr("href", strThisFinalUrl);
			allHtmlAnchorsWithSearchUrl.attr("target", "_blank");
		}
		
	}
});
	