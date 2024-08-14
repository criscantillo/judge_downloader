let tdLinks = null;
let domTarget = null;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    //console.log(message, sender);

    switch(message.opt){
        case 'get_links':
            sendResponse({data: arrLinks});
            break;
			
		case 'retry':
            searchLinks();
            break;

        case 'reload':
            window.location.replace(message.data);
            break;

		case 'enable-search':
			enableSearchFilesDOM();
			break;

		case 'disable-search':
			disableSearchFilesDOM();
			break;

		case 'get-url':
			sendLocation();
			break;

		case 'scan-files-url':
			searchLinksFiles();
			break;
    }
});

moment.locale('es', 
    {
      months: 'Enero_Febrero_Marzo_Abril_Mayo_Junio_Julio_Agosto_Septiembre_Octubre_Noviembre_Diciembre'.split('_'),
      monthsShort: 'Enero._Feb._Mar_Abr._May_Jun_Jul._Ago_Sept._Oct._Nov._Dec.'.split('_'),
      weekdays: 'Domingo_Lunes_Martes_Miercoles_Jueves_Viernes_Sabado'.split('_'),
      weekdaysShort: 'Dom._Lun._Mar._Mier._Jue._Vier._Sab.'.split('_'),
      weekdaysMin: 'Do_Lu_Ma_Mi_Ju_Vi_Sa'.split('_')
    }
);

let mm = moment('04/07/2023', 'DD/MM/yyyy');
//let mm = moment();

let format_dates = [
	{'f':'DD/MM/yyyy', 'upper':false}, {'f':'DD.MM.yyyy', 'upper':false}, 
	{'f':'DD MMMM yyyy', 'upper':false}, {'f':'MMMM DD [DE] yyyy', 'upper':true}
];

let arrLinks = [];
let td_today = null;
let all_links = {};
let links = null;

function searchLinks(){
	for(var i = 0; i < format_dates.length; i++){
		let date = mm.format(format_dates[i].f);
		
		if(format_dates[i].upper)
			date = date.toUpperCase();

		td_today = $('table').find(`td:contains("${date}")`);

		if(td_today.length > 0){
			searchLinksInDOM(td_today);
			break;
		}
	}

	if(links && links.length > 0){
		setTimeout(function(){
			hideAllTables();
			showCurrentTable();
			td_today.parents('table')[0].scrollIntoView();
		}, 800);

		cleanLinks();
	}
}

function searchLinksInDOM(td_today){
	let rowspan = -1;

	if(td_today.attr('rowspan') != null && td_today.attr('rowspan') != '')
		rowspan = (td_today.attr('rowspan')*1);

	links = td_today.parent().find('a');
	all_links['0'] = links;

	if(rowspan != -1){
		let tr = td_today.parent().next();
		for(var x = 1; x < rowspan; x++){
			let another_links = tr.find('a');
			if(another_links.length > 0)
				all_links[x] = another_links;

			tr = tr.next();
		}
	}
}

function cleanLinks(){
	arrLinks = [];

	for(var l in all_links){
		let jLinks = all_links[l];

		jLinks.each(function(){
			let href = this.href;

			if(href.indexOf('_INSTANCE_') == -1 && arrLinks.indexOf(href) == -1){
				let fileName = $(this.childNodes[0]).text();
				fileName = fileName.trim().replace(/ /g, '_');

				if(fileName.toUpperCase().indexOf('.PDF') == -1){
					fileName += '.pdf';
				}

				arrLinks.push({url:href, name:fileName});
			}
		});
	}
}

async function downloadLinks(){
	if(domTarget.tagName == 'UL'){
		searchLinksTargetInDOM($(domTarget));
	}else{
		searchLinksInDOM($(tdLinks));
	}
	
	cleanLinks();
	disableSearchFilesDOM();

	await chrome.runtime.sendMessage({type: 'links', data: arrLinks, url:window.location.href});
}

function getFormatDate(date){
    let day = date.getDate().toString().padStart(2,'0');
    let month = (date.getMonth() + 1).toString().padStart(2,'0');
    let year = date.getFullYear().toString();

    let strDate = `${day}/${month}/${year}`;

    return strDate;
}

function hideAllTables(){
    $('.aui-widget-bd').addClass('aui-helper-hidden');
}

function showCurrentTable(){
    td_today.parents('.aui-widget-bd').removeClass('aui-helper-hidden');
}

//Init
//searchLinks();

function enableSearchFilesDOM(){
	$(document).on('mouseover', async function(e){
		if(tdLinks == null)
			$(e.target).addClass('item-selected');

		await chrome.runtime.sendMessage({type: 'location', url:window.location.href});
	});
	
	$(document).on('mouseout', function(e){
		$(e.target).removeClass('item-selected');
	});

	$(document).on('click', function(e){
		tdLinks = e.target;
		domTarget = e.target;
		$(e.target).removeClass('item-selected');

		downloadLinks();
	});
}

function disableSearchFilesDOM(){
	$(document).unbind();
	tdLinks = null;
}

function searchLinksTargetInDOM(target){
	if(target.hasClass('efecto')){
		links = target.find('a');
	}else{
		links = target.parents('.efecto').find('a');
	}
	
	all_links['0'] = links;
}

async function sendLocation(){
	await chrome.runtime.sendMessage({type: 'location', url:window.location.href});
}

async function searchLinksFiles(){
	let articleIds = [];
	$('a[href*="articleId="]').each(function(){
		let articleId = getArticleId(this.href);
		if(articleIds.indexOf(articleId) == -1)
			articleIds.push(articleId);
	});

	if(articleIds.length > 0){
		await sendArticuleIds(articleIds);
	}
}

function getArticleId(url) {
    const regex = /articleId=(\d+)/;
    const matches = url.match(regex);
  
    if (matches) {
      return matches[1];
    } else {
      return null;
    }
}

async function sendArticuleIds(articleIds){
	await chrome.runtime.sendMessage({type: 'judge-ids', data: articleIds, url:window.location.href});
}