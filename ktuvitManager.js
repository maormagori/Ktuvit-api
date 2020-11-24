const superagent = require("superagent")
    require('superagent-charset')(superagent),
    jsdom = require('jsdom');


// TODO: add error handling everywhere.
class KtuvitManager {
    
    constructor(loginCookie){
        this.BASE_URL = "https://www.ktuvit.me/";
        this.KTUVIT = {
            SEARCH_URL: this.BASE_URL + "Services/ContentProvider.svc/SearchPage_search",
            MOVIE_INFO_URL: this.BASE_URL + "MovieInfo.aspx?ID=",
            EPISODE_INFO_URL: this.BASE_URL + "Services/GetModuleAjax.ashx?",
            REQUEST_DOWNLOAD_IDENTIFIER_URL: this.BASE_URL + "Services/ContentProvider.svc/RequestSubtitleDownload",
            DOWNLOAD_SUB_URL: this.BASE_URL + "Services/DownloadFile.ashx?DownloadIdentifier="
        };
        this.loginCookie = loginCookie;
        this.headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "cookie": `Login=${this.loginCookie}`
        }
        
    }
    


    postWithLoginInfo(link, data){
        return new Promise((resolve, reject)=>{
            superagent.post(link)
            .withCredentials()
            .set(this.headers)
            .send({"request" :data})
            .then((res) => { resolve(res)})
            .catch((err) => {reject(err)})
        })
    }

    getWithLoginInfo(link){
        return new Promise((resolve, reject)=>{
            superagent.get(link)
            .withCredentials()
            //.timeout({deadline: 6000})
            .set(this.headers)
            .then((res) => { resolve(res)})
            .catch((err) => {reject(err)})
        })
    }

    /**
     * 
     * @param {Object} item      The title to search. includes: name, year, type, imdbId. All strings.
     */
    async getKtuvitID(item){

        const query = {"FilmName": item.name,
                    "Actors": [],
                    "Studios": null,
                    "Directors": [],
                    "Genres": [],
                    "Countries": [],
                    "Languages": [],
                    "Year": `${item.year}`.split("–")[0],
                    "Rating": [],
                    "Page": 1,
                    "SearchType": item.type === "movie" ? "0":"1",
                    "WithSubsOnly": false
        };

        //console.log(query)

        if (item.type === "movie")
            query.SearchType = "0";
        else
            query.SearchType = "1";

        try{
            let res = await this.postWithLoginInfo(this.KTUVIT.SEARCH_URL,query);
            return this.findIDInResults(res.body, item.imdbId);
        } catch (err) {
            console.log("addHeaders: Bad Request:");
            console.log(err);
        }
        

    }

    findIDInResults(body, imdbId){
        //console.log(body);
        //console.log({ImdbId: imdbId,body: body});
        const films = [...JSON.parse(body.d).Films]

        return films.find(title => title.ImdbID == imdbId).ID;
    }

    async getSubsIDsListEpisode(ktuvitID, season, episode){
        
        //bulding the query. A simple query builder string.
        var query_string = `moduleName=SubtitlesList&SeriesID=${ktuvitID}&Season=${season}&Episode=${episode}`

        var res = await this.getWithLoginInfo(this.KTUVIT.EPISODE_INFO_URL+query_string);
        var subtitlesIDs = this.extractSubsFromHtml(res.text);
        //console.log(subtitlesIDs);
        return subtitlesIDs;

    }

    async getSubsIDsListMovie(ktuvitID){
        var res = await this.getWithLoginInfo(this.KTUVIT.MOVIE_INFO_URL+ktuvitID);
        var subtitlesIDs = this.extractSubsFromHtml(res.text);
        return subtitlesIDs;
    }

    extractSubsFromHtml(html) {
        //The episode html only contains the subtitle rows and since I built this function
        //for the movie's html so I need to add the missing information.
        html = html.includes('<!DOCTYPE html>') ? html:`<!DOCTYPE html><table id="subtitlesList"><thead><tr/></thead>${html}</table>`

        var dummyDom = new jsdom.JSDOM(html).window;
        var subtitlesListElement = dummyDom.document.getElementById('subtitlesList');
        subtitlesListElement = [...subtitlesListElement.rows];
        subtitlesListElement.shift();
        //console.log(subtitlesListElement.length);
        var subtitlesIDs = subtitlesListElement.map((sub) => {
            //Getting sub's file name from html.
            //I don't care it's this way, it works.
            //I never learned jquery so don't judge me.
            let subName = sub.cells[0].querySelector("div").innerHTML.split('<br>')[0];
            
            //trimming sub's name
            subName = subName.trim();

            //Getting the sub's ktuvit id.
            let id  = sub.cells[5].firstElementChild.getAttribute('data-subtitle-id');

            //Amount of times the sub has been downloaded.
            let downloads = parseInt(sub.cells[4].innerHTML);

            //The sub file's upload date.
            let uploadDate = new Date(sub.cells[3].innerHTML.split('/').reverse().join('-'));
            
            //The sub file size.
            let size = sub.cells[2].innerHTML;

            //Sub's file type.
            let fileType = sub.cells[1].innerHTML;

            //The sub creator
            let credit = sub.cells[0].querySelector("div > small").innerHTML;

            return {subName: subName,
                id: id,
                downloads: downloads,
                uploadDate: uploadDate,
                size: size,
                fileType: fileType,
                credit: credit
            };
        });

        return subtitlesIDs;
    }

    async downloadSubtitle(KtuvitId, subId, cb){
        const downloadIdentifierRequest = {
            "FilmID": KtuvitId,
            "SubtitleID": subId,
            "FontSize": 0,
            "FontColor": "",
            "PredefinedLayout": -1
        };

        let downloadIdentifier = await this.postWithLoginInfo(this.KTUVIT.REQUEST_DOWNLOAD_IDENTIFIER_URL,downloadIdentifierRequest);
        downloadIdentifier = JSON.parse(downloadIdentifier.body.d).DownloadIdentifier
        
        await superagent.get(this.KTUVIT.DOWNLOAD_SUB_URL + downloadIdentifier)
            .charset('ISO-8859-8')
            .withCredentials()
            .set(this.headers)
            .buffer(true)
            .then(res => {cb(res.text)})
            .catch(err => err)
    }


}

var manager = new KtuvitManager('u=7CA271EC2204B13FAE3F3CFE9D24F3AC&g=3B82622A00E8D3D24F982498638320F48803A3A8CED4220DEDCFBE2A06219528853A8A8AFC7589346C15A2979E58EC07');
manager.getSubsIDsListEpisode('6472AA8A95AFD000664C8CA525604B38', 1, 2).then(res => {console.log(res)})

module.exports = KtuvitManager;
