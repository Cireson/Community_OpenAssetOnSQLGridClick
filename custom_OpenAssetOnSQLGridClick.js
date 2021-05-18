/* ----------------------------------------------- */
/* --------- Open Asset on SQL Grid Click -------- */
/* ----------------------------------------------- */
// v10.5.1
// Contributors: Joivan, Shane White
// Description: If a dashboard grid view has a column that contains the name "BaseManagedEntityId" or "ArticleId", and that column has the Entity ID (or Article ID), 
//				then this script makes the row clickable, going to the asset object (hardware, location, organization, Dynamic Data/Business service, custom class, KB Article, etc) in a new tab.


$(document).ready(function () {

	var url = window.location.href;
	if(url.indexOf("/Page/") == -1 )
	{ 
		// Loosely verify we are on a dashboard page, not using hte GetProjection API call.
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
			//The dashboard element, although incomplete, loads at the same time as the title. If it exists, then this is a dashboard page. If not, then it will never exist.
			observer.disconnect();
			return;
		}		
		
		var allGridElements = $('[data-role=grid]'); // Get one or more grid div elements
		if (allGridElements.length == 0) {
			return;
		}
		
		var strThisScriptClassElement = "opensqlgridclick";
		
		for(var i=0; i < allGridElements.length; i++) {
			
			var gridElement = $(allGridElements[i]); // Get this one grid div element
			
			var kendoGridElement = gridElement.getKendoGrid(); //...as a kendo widget
			if (kendoGridElement.columns.length == 0) {
				continue;
			}
			
			if (gridElement.find("tr").length < 2) { //It might be 1 if only the headers loaded...
				continue;
			}
			
			if (gridElement.find("." + strThisScriptClassElement).length > 0) {
				//console.log("element '" + strThisScriptClassElement + "' already exists on grid " + i + ".");
				continue;
			}
			
			gridElement.append("<span class=" + strThisScriptClassElement + " />");
			
			//We have table rows. 
			UnbindDefaultGridClickBehavior(gridElement);
			
		}
		
		
		var allProcessedGrids = $("." + strThisScriptClassElement);
		if (allGridElements.length == allProcessedGrids.length) {
			//We are done observing.
			console.log("SQL Grid Click - All grid clicks accounted for.");
			observer.disconnect();
		}
		
	});
	
	
	// configure the observer and start the instance.
	var observerConfig = { attributes: true, childList: true, subtree: true, characterData: true };
	observer.observe(mainPageNode, observerConfig);
	
	
	function UnbindDefaultGridClickBehavior(gridElement) {
		//var gridElement = $('[data-role=grid]'); // Get the grid div element(s)
		
		for(var j=0; j < gridElement.length; j++) {
			//console.log(gridElement[j]); //TODO; delete me!
			var thisGridElement = $(gridElement[j]);
			var kendoGridElement = thisGridElement.getKendoGrid(); //...as a kendo widget
			var indexWithGuid = -1;
			var indexWithArticleId = -1;
			
			for(var i = 0; i < kendoGridElement.columns.length; i++) {
				
				if (kendoGridElement.columns[i].field.toUpperCase() == "ID" ) { //Leave this grid alone entirely. 
					console.log("Ignoring grid that has column with name '" + kendoGridElement.columns[i].field + "'.");
					return;
				}
				
				if (kendoGridElement.columns[i].field.toUpperCase().indexOf("BASEMANAGEDENTITYID") > -1 ) { //as of 8.9.4, do this for the upper case bug. 
					indexWithGuid = i; //kendoGridElement.columns[i].field; //perhaps "HWA_BaseManagedEntityId" ? Or whatever the SQL named it.
					break;
				}
				
				if (kendoGridElement.columns[i].field.toUpperCase().indexOf("ARTICLEID") > -1 ) { //as of 8.9.4, do this for the upper case bug. 
					indexWithArticleId = i; //kendoGridElement.columns[i].field; //perhaps "KB_ArticleId" ? Or whatever the SQL named it.
				}
			}
			
			//If we still don't have our proper field, then maybe this is a KB article, with no GUID.
			
			if (indexWithGuid < 0 && indexWithArticleId < 0) {
				continue;; //This grid doesn't have a BASEMANAGEDENTITYID column or ArticleId column.
			}
			
			kendoGridElement.unbind("change"); //Undo the change binding on this grid, on row select. By default, it will take us to a useless search page.
			gridElement.off("click"); //So that clicking on the cell doesn't go to the URL within the A tag.
			
			//
			if (indexWithGuid > -1) {
				//kendoGridElement.hideColumn(indexWithGuid); //This default kendo call breaks the object, and doesn't actually hdie the column sometimes.
				kendoGridElement.indexToHide = indexWithGuid;
				HideKendoGridColumn(kendoGridElement);
				
				DetermineObjectUrlAndBindAnchors(kendoGridElement);
				
				
				//hide this column by default. Last.

			}
			else if (indexWithArticleId > -1) {
				//kendoGridElement.hideColumn(indexWithArticleId); //This default kendo call breaks the object, and doesn't actually hdie the column sometimes.
				kendoGridElement.indexToHide = indexWithArticleId;
				HideKendoGridColumn(kendoGridElement);
				
				var baseObjectUrlOnSqlClick = "/KnowledgeBase/Edit/"    //"/KnowledgeBase/Edit/" + articleId
				kendoGridElement.baseObjectUrlOnSqlClick = baseObjectUrlOnSqlClick;
				
				//Each row contains an a tag to a useless page. Remove it on datasource or page change.
				RemoveDefaultClickBinding(kendoGridElement);
				
				//And call it once for the current page.
				RemoveAndReplaceDefaultAnchorTagsFromGrid(kendoGridElement);
			}
			else{
				console.log("Unsure how to proceed with setting up SQL clicks on grids.");
			}
		};
	}
	
	function RemoveDefaultClickBinding(kendoGridElement) {
		kendoGridElement.bind("dataBound", RemoveAndReplaceDefaultAnchorTagsFromGrid);
		kendoGridElement.bind("filter", RemoveAndReplaceDefaultAnchorTagsFromGrid);
		kendoGridElement.bind("sort", RemoveAndReplaceDefaultAnchorTagsFromGrid);
	}
	
	function DetermineObjectUrlAndBindAnchors(kendoGridElement) {
		
		
		var gridElement = kendoGridElement.element; //...as a normal grid.
		
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
					
					var baseObjectUrlOnSqlClick = "";
					if (assetObject.ClassName.indexOf("AssetManagement") > -1) {
						baseObjectUrlOnSqlClick = "/AssetManagement/" + shortClassName + "/Edit/"    //"/AssetManagement/HardwareAsset/Edit/" + strEntityId
						if (shortClassName != "HardwareAsset" && shortClassName != "SoftwareAsset") {
							baseObjectUrlOnSqlClick = "/AssetManagement/Administration/" + shortClassName + "/Edit/"    //"/AssetManagement/Administration/Location/Edit/" + strEntityId
						}
					}
					else{
						//Use dynamic data instead.
						baseObjectUrlOnSqlClick = "/DynamicData/Edit/"  //"/DynamicData/Edit/" + strEntityId
					}
					
					kendoGridElement.baseObjectUrlOnSqlClick = baseObjectUrlOnSqlClick;
					
					//Each row contains an a tag to a useless page. Remove it on datasource or page change.
					RemoveDefaultClickBinding(kendoGridElement);
					
					//And call it once for the current page.
					RemoveAndReplaceDefaultAnchorTagsFromGrid(kendoGridElement);
					
				}
				else{
					console.log("Unable to find object with ID '" + strEntityId + "'.");
				}
			}
		});
	}
	
	function HideKendoGridColumn(kendoGridElement) {
		//Because for dashboard pages in Portal 9.0.13, 8.2.1, 9.3.4+, kendoGridElement.hideColumn(indexWithGuid) is sometimes broken.
		
		var gridElement = $(kendoGridElement.element);
		var indexToHide = kendoGridElement.indexToHide;
		
		kendoGridElement.bind("dataBound", HideFirstColumnInThisKendoGrid);
		kendoGridElement.bind("filter", HideFirstColumnInThisKendoGrid);
		kendoGridElement.bind("sort", HideFirstColumnInThisKendoGrid);
		
		//call it once to hide it.
		HideFirstColumnInThisKendoGrid(kendoGridElement);
		
		//And then one time only, create column elements within the table and assign a width.
		var headerTable = gridElement.find(".k-grid-header table");  //= $('.k-grid .k-grid-header table');
		var contentTable = gridElement.find(".k-grid-content table"); //$('.k-grid .k-grid-content table');
		

		// Reset the headers and columns to the same minimum width
		var col = headerTable.find('colgroup col:eq(' + indexToHide + ')').add(contentTable.find('colgroup col:eq(' + indexToHide + ')')); ////var col = headerTable.find('colgroup col:eq(0)').add(contentTable.find('colgroup col:eq(0)'));
		col.css('width', "0px");
		
		
		function HideFirstColumnInThisKendoGrid(e) {
			//Is e an element, or an existing kendo grid?
			var kendoGrid = null;
			
			if (e.dataSource == null)  //it's an element
				kendoGrid = e.sender;
			else
				kendoGrid = e; //its already a kendo grid from the parameter.
			
			var htmlElement = $(kendoGrid.element);
			var indexToHide = kendoGrid.indexToHide
			
			
			htmlElement.find("table").find("tr").each(function () {
				$(this).children("td:eq(" + indexToHide + ")").children().css("display", "none"); //$(this).children("td:eq(0)").html("");
			});
		}
	}
	
	
	function RemoveAndReplaceDefaultAnchorTagsFromGrid(e) {
		
		//Is e an element, or an existing kendo grid?
		var kendoGrid = null;
		var htmlElement = null;
		
		if (e.dataSource == null) { //it's an element
			kendoGrid = e.sender;
		}
		else{
			kendoGrid = e; //its already a kendo grid from the parameter.
		}
		htmlElement = kendoGrid.element;
		
		//Get our base URL which should have been previously saved to our kendo grid.
		var strBaseObjectUrlOnSqlClick = kendoGrid.baseObjectUrlOnSqlClick;
		if (strBaseObjectUrlOnSqlClick == null) {
			console.log("The grid had no value for the new SQL click URL.");
			return;
		}
		
		// Shane White - Changed whole section of code here due to change in the source code - 18/08/21
		// There is no longer a href element in the grid by default so we have to create it
		var htmlElementRows = $(htmlElement.find("tr"));
		
		for(var i = 0; i < htmlElementRows.length; i++) {
			
			var htmlAnchorsToAddSearchUrl = $($(htmlElementRows[i]).find("td")[1]);
			
			for(var j = 0; j < htmlAnchorsToAddSearchUrl.length; j++) {
				//Update the a tag with the URL and baseId.
				var thisTr = $(htmlAnchorsToAddSearchUrl[j]).closest("tr");
				var thisKendoDataItem = kendoGrid.dataItem(thisTr);
				
				var strThisFinalUrl = strBaseObjectUrlOnSqlClick + thisKendoDataItem.BaseManagedEntityId;
				if (thisKendoDataItem.BaseManagedEntityId == null) {
					strThisFinalUrl = strBaseObjectUrlOnSqlClick + thisKendoDataItem.ArticleId;
				}
				
				// We need to find the first column that is not the Id to put back in the title of the column into the href
				var columnNameToDisplay = kendoGrid.columns[1].title;
				
				// Wipe out text so it dos not show double
				$(htmlAnchorsToAddSearchUrl[j]).text("");
				// Add this class to get the nice formatting in the grid
				$(htmlAnchorsToAddSearchUrl[j]).addClass("grid-highlight-column");
				// Add in the href element
				$(htmlAnchorsToAddSearchUrl[j]).append("<a href=\"" + strThisFinalUrl + "\">" + thisKendoDataItem[columnNameToDisplay] + "</a>");
			}
		}
		
		var gridElement = $(htmlElement);
		gridElement.find("td").off("click");
	}
});
	
/* Example Asset SQL query that can be placed in a Dashboard.
select 
BaseManagedEntityId
,DisplayName
,SerialNumber_C8CF2E89_7A83_1C26_0AD0_887DF9140D5A as SerialNumber
,AssetTag_A3A8959C_F361_A6A8_B242_0013702442B3 as AssetTag
 from ServiceManager.dbo.MT_Cireson$AssetManagement$HardwareAsset
 */
 
 /* Example Dynamic Data (business service) SQL query that can be placed in a Dashboard.
 select 
BaseManagedEntityId
,DisplayName
,Notes_5CFC0E2A_AB82_5830_D4BB_0596CBED1984
,Status_0689C997_03F2_83DE_C0E7_FB8E18574552
from MT_Microsoft$SystemCenter$BusinessService
*/

/* Example KB Article SQL query that can be placed in a Dashboard.
select ArticleId, Title, Abstract, ViewCount from KnowledgeArticle
*/
