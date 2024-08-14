/*global chrome*/
let path = '';
let currentUrl = '';
let judgedData = [];
let judgeIds = [];
const JUDGE_KEY = 'db.judgedData.1';
const JUDGE_URL_IDS = 'db.judgeIds.1';

loadJudgeData();
loadJudgeIds();
getLocationUrl();
scanUrlFiles();

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.type == 'location'){
            currentUrl = request.url;

            let judge = judgedData.find(x => x.url == currentUrl);
            if(judge != null){
                loadJudgePath(judge);
            }else{
                const articleId = getArticleId(currentUrl);
                if(articleId != null){
                    const judgeUrl = judgeIds.find(x => x.ids.indexOf(articleId) != -1);
                    if(judgeUrl){
                        judge = judgedData.find(x => x.url == judgeUrl.url);
                        loadJudgePath(judge);
                    }
                }
            }
        }
        
        if(request.type == 'links'){
            responseDownloadFiles(request);
        }

        if(request.type == 'judge-ids'){
            let judge = judgeIds.find(x => x.url == currentUrl);
            if(judge == null){
                judgeIds.push({'url': currentUrl, 'ids':request.data});
            }else{
                judge.ids = request.data;
            }

            localStorage.setItem(JUDGE_URL_IDS, JSON.stringify(judgeIds));
            console.log(judgeIds);
        }
    }
);

$(document).ready(function() {
    $('#_folder').on('change', function(){
        if(path != ''){
            modifyJudge();
        }

        path = $('#_folder').val();
    });

    $('#btnDownloadAll').on('click', function(){
        if(validatePath()){
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {opt:'get_links'}, function(response){
                    if(path == ''){
                        alert('Debes indicar una ruta para guardar los archivos');
                        return;
                    }
    
                    responseDownloadFiles(response);
                });
            });
        }
    });

    $('#btnPag').on('click', function(){
        if(judgedData.length == 0){
            alert('No has registrado páginas');
            return;
        }

        judgedData.forEach((jData)=>{
            chrome.tabs.create({ url: jData.url, active: false });
        });
    });

    $('#btnSearch').on('click', function(){
        if(validatePath()){
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                let message = {opt:'enable-search'};
                
                chrome.tabs.sendMessage(tabs[0].id, message, function(response){});
            });
        }
    });

    $('#btnCancel').on('click', function(){
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			let message = {opt:'disable-search'};
			
            chrome.tabs.sendMessage(tabs[0].id, message, function(response){});
        });
    });

    $('#deletePage').on('click', function(){
        deleteJudge();
    });

    $('#savePage').on('click', function(){
        saveNewJudge(currentUrl);
    });

    $('#btnImport').on('click', function(){
        $('#_json').trigger('click');
    });

    $('#_json').on('change', function(){
        if(this.files.length > 0){
            readJsonData(this.files[0]);
        }
    });

    $('#btnExport').on('click', function(){
        exportJsonData();
    });
});

function loadJudgePath(judge){
    path = judge.path;
    $('#_folder').val(judge.path);
}

function validatePath(){
    if(path == ''){
        alert('Debes indicar una ruta para guardar los archivos');
        return false;
    }

    return true;
}

function responseDownloadFiles(response){
    if(response.data.length > 0){
        let urlFiles = response.data;

        for(var i = 0; i < urlFiles.length; i++){
            let urlFile = urlFiles[i];
            if(urlFile.url.indexOf('sharepoint.com') != -1){
                openExternalStorage(urlFile.url);
            }else{
                downloadFile(urlFile, path);
            }
        }
    }else{
        alert('No se encontraron documentos para descargar');
    }
}

function downloadFile(urlFile, path){
    let fileName = urlFile.name;
    let routeFile = `${path}/${fileName}`;

    console.log(urlFile);

    chrome.downloads.download({
        url: urlFile.url,
        filename: routeFile 
    }, function(downloadId){
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        } else {
            console.log('Descarga iniciada con ID:', downloadId);
        }
    });
}

function openExternalStorage(url){
    chrome.tabs.create({ url: url, active: false }); 
}

function saveNewJudge(url){
    const idx = judgedData.findIndex(x => x.url == url);
    if(idx == -1){
        if($('#_folder').val() == ''){
            alert('Debes indicar el nombre de la carpeta');
            return;
        }

        const newJudge = {
            "url": url,
            "path": $('#_folder').val()
        };
    
        judgedData.push(newJudge);
        localStorage.setItem(JUDGE_KEY, JSON.stringify(judgedData));
        refreshJudgeLabel();
    }
}

function deleteJudge(){
    const idx = judgedData.findIndex(x => x.url == currentUrl);

    if(idx != -1){
        judgedData.splice(idx, 1);
        localStorage.setItem(JUDGE_KEY, JSON.stringify(judgedData));
        refreshJudgeLabel();
        $('#_folder').val('');
        alert('Juzgado eliminado del registro');
    }
}

function modifyJudge(){
    const judge = judgedData.find(x => x.url == currentUrl);

    if(judge != null){
        judge.path = $('#_folder').val();
        localStorage.setItem(JUDGE_KEY, JSON.stringify(judgedData));
    }
}

function loadJudgeData(){
    const judgeDataBD = localStorage.getItem(JUDGE_KEY);
    if(judgeDataBD){
        judgedData = JSON.parse(judgeDataBD);
    }

    refreshJudgeLabel();
}

function getLocationUrl(){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        let message = {opt:'get-url'};
        chrome.tabs.sendMessage(tabs[0].id, message, function(response){});
    });
}

function readJsonData(file){
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
        try{
            const resultData = JSON.parse(event.target.result);
            if(resultData.length > 0){
                if(resultData[0].url != null && resultData[0].path != null){
                    judgedData = resultData;
                    localStorage.setItem(JUDGE_KEY, JSON.stringify(judgedData));
                    refreshJudgeLabel();
                }
            }
        }catch(e){
            console.error(e);
            alert('Error al importar los datos');
        }
    });
    reader.readAsText(file);
}

async function exportJsonData(){
    const judgeDataBD = localStorage.getItem(JUDGE_KEY);
    if(judgeDataBD){
        await saveFile(judgeDataBD);
    }else{
        alert('No hay información para exportar');
    }
}

async function saveFile(judgeDataBD) {
    try {
      const newHandle = await window.showSaveFilePicker({
        suggestedName: 'miData.json',
        types: [{
          description: 'rama judicial data',
          accept: {
            'text/json': ['.json'],
          },
        }],
      });
      const writableStream = await newHandle.createWritable();

      await writableStream.write(judgeDataBD);
      await writableStream.close();
      alert('Los datos se han exportado');
    } catch (err) {
      console.error(err.name, err.message);
    }
}

function refreshJudgeLabel(){
    $('#judgesReg').html(judgedData.length);
}

function loadJudgeIds(){
    const judgeIdsBD = localStorage.getItem(JUDGE_URL_IDS);
    if(judgeIdsBD){
        judgeIds = JSON.parse(judgeIdsBD);
    }
}

function scanUrlFiles(){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        let message = {opt:'scan-files-url'};
        chrome.tabs.sendMessage(tabs[0].id, message, function(response){});
    });
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