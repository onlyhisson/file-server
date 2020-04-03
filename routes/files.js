const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const SEL_DATE_LENGTH = 7;                              // 몇일 전까지의 파일 조회 조건
const FILE_PATH = '/home/fbn/finl_dump';                // 최소단위 블럭데이터 파일 path
const TOTAL_DATA_FILE_PATH = '/home/fbn/finl_dump_tmp'; // 전체, 년, 월 단위 블럭데이터 파일 path
const DATE_TO_ENG = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "June",
    7: "July",
    8: "Aug",
    9: "Sept",
    10: "Oct",
    11: "Nov",
    12: "Dec"
}

let FILE_INFO_LIST = [];        // 파일 정보 Object Array 변수
setInterval(async function(){   // 주기적으로 미리 파일 리스트 저장
    FILE_INFO_LIST = await getEditFileInfos(FILE_PATH); 
},3000);

/************************************************************* 
 * prefix : /files
**************************************************************

/* 
    @author onlyhisson
    @param  object req
    @param  object res
    @return object json 데이터
    @note   전체 파일 리스트 GET
*/
router.get('/list', async function (req, res) {
    const yearArr = await getFileList(FILE_PATH);
    let fileArr= [];

    try {
        const totalObj = await getEditFileInfo(TOTAL_DATA_FILE_PATH);
        fileArr = FILE_INFO_LIST.slice();   // 파일 edit 정보 배열 복사
        fileArr.unshift(totalObj);          // total 데이터를 배열 앞에 추가
        const obj = {
            status: 0,
            yearArr, 
            reqDate: [0,0,0],
            monthArr: DATE_TO_ENG,
            fileLength: fileArr.length,
            fileInfo: fileArr
        }
        responseHandler(obj, res);
    } catch (err) {
        errorHandler(err, res);
    };
});

/* 
    @author onlyhisson
    @param  object req
    @param  object res
    @return object json 데이터
    @note   일단위 파일 리스트 GET
*/
router.get('/list/:yy/:mm/:dd', async function (req, res) {
    const yearArr = await getFileList(FILE_PATH);
    const yy = req.params.yy;
    const mm = DATE_TO_ENG[Number(req.params.mm)];
    const dd = req.params.dd;
    const path = `${FILE_PATH}/${yy}/${mm}/${dd}`;

    try {
        const fileArr = await getEditFileInfos(path);
        const obj = {
            status: 0,
            yearArr,
            reqDate: [yy, req.params.mm, dd],
            monthArr: DATE_TO_ENG,
            fileLength: fileArr.length,
            fileInfo: fileArr
        }
        responseHandler(obj, res);
    } catch (err) {
        errorHandler(err, res);
    };
});

/* 
    @author onlyhisson
    @param  object req
    @param  object res
    @return object json 데이터
    @note   월단위 파일 리스트 GET
*/
router.get('/list/:yy/:mm', async function (req, res) {
    const yearArr = await getFileList(FILE_PATH);
    const yy = req.params.yy;
    const mm = DATE_TO_ENG[Number(req.params.mm)];
    const path = `${FILE_PATH}/${yy}/${mm}`;
    const totalDataPath = `${TOTAL_DATA_FILE_PATH}/${yy}/${mm}`;
    let fileArr = [];

    try {
        const totalObj = await getEditFileInfo(totalDataPath);  // A 해당 월 total data get
        fileArr = await getEditFileInfos(path);                 // B 해당 월 최소 unit 데이터 리스트
        fileArr.unshift(totalObj);                              // A + B
        const obj = {
            status: 0,
            yearArr,
            reqDate: [yy, req.params.mm,0],
            monthArr: DATE_TO_ENG,
            fileLength: fileArr.length,
            fileInfo: fileArr
        }
        responseHandler(obj, res);
    } catch (err) {
        errorHandler(err, res);
    };
});

/* 
    @author onlyhisson
    @param  object req
    @param  object res
    @return object json 데이터
    @note   년단위 파일 리스트 GET
*/
router.get('/list/:yy', async function (req, res) {
    const yearArr = await getFileList(FILE_PATH);
    const yy = req.params.yy;    
    const path = `${FILE_PATH}/${yy}`;
    const totalDataPath = `${TOTAL_DATA_FILE_PATH}/${yy}`;
    let fileArr = [];

    try {
        const totalObj = await getEditFileInfo(totalDataPath);  // A 해당 월 total data get
        fileArr = await getEditFileInfos(path);                 // B 해당 년 최소 unit 데이터 리스트
        fileArr.unshift(totalObj);                              // A + B
        const obj = {
            status: 0,
            yearArr,
            reqDate: [yy, 0,0],
            monthArr: DATE_TO_ENG,
            fileLength: fileArr.length,
            fileInfo: fileArr
        }
        responseHandler(obj, res);
    } catch (err) {
        errorHandler(err, res);
    };
});

/* 
    @author onlyhisson
    @param  object req
    @param  object res
    @return 파일
    @note   파일 다운로드
*/
router.get('/download/:filename', async function (req, res) {
    const fileName = req.params.filename;
    const fnParse = fileName.split('~');
    const enMonth = Object.values(DATE_TO_ENG);
    let fileFullName = '';

    if (fnParse.length < 2) {   // minimum unit data
        const dateArr = fileName.split('-');
        fileFullName = `${FILE_PATH}/${dateArr[2].substring(0,4)}/${dateArr[1]}/${dateArr[0]}/${fileName}`
        res.download(fileFullName);
        return;
    };

    // 클라이언트가 응답 받은 때와 블록 데이터의 업데이트 때의 시간 차로 파일명이 다를 수 있기 때문에
    // 요청 받은 파일명이 아닌 해당 경로의 파일 이름을 재조회 후 다운로드(전체, 년, 월 모두 해당)
    if(fnParse[0] == 'FINL_ALL_DB') {   // total data
        fileFullName = await getFileOne(TOTAL_DATA_FILE_PATH);
    } else if(enMonth.includes(fnParse[0])) {  // month total data
        const yy = fnParse[1].split('-')[2].substring(0,4);
        fileFullName = await getFileOne(`${TOTAL_DATA_FILE_PATH}/${yy}/${fnParse[0]}`);
    } else {    // year total data
        fileFullName = await getFileOne(`${TOTAL_DATA_FILE_PATH}/${fnParse[0]}`);
    }
    res.download(fileFullName);
});


///////////////////////////////////////////////////////////////////////////////
// function
///////////////////////////////////////////////////////////////////////////////

/* 
    @author onlyhisson
    @param  string path 파일 리스트를 조회할 최상위 폴더 경로
    @return 각 파일의 이름, 크기, 생성일, md5 데이터 Object Array
*/
async function getEditFileInfos(path) {
    const result = await getFiles(path);
    let fileArr = [];
    for (const item of result) {
        let temp = {};
        let file_name = item.split('/').pop(); //파일의 마지막 이름만 들어감.
        temp = await editFiles(file_name);
        fileArr.unshift(temp);
    };

    return fileArr.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)); // desc soring(date)
};

/* 
    @author onlyhisson
    @param  string path 파일 리스트를 조회할 최상위 폴더 경로
    @return 한 파일의 이름, 크기, 생성일, md5 데이터 Object
*/
async function getEditFileInfo(path) {
    const fileFullName = await getFileOne(path);
    const fileName = fileFullName.split('/').pop();
    const fileInfo = await getFileInfo(fileFullName);
    const hash = await fileHash(fileFullName, 'md5');
    const jsonObj = {
        fileName: fileName,
        size: fileInfo.size,
        md5: hash,
        date: fileInfo.birthtimeMs
    };
    return jsonObj
};

// 다운로드 파일 데이터 초기화
async function setFileInfo(dates) {

    let dateDir = [];
    let fileList = [];
    let fileTempInfo = [];

    for(let i=0; i<dates; i++) {
        let pathOne = '';
        let settingDate = new Date();
        settingDate.setDate(settingDate.getDate()-i); // i일 전
        let yy2 = settingDate.getFullYear();
        let mm2 = DATE_TO_ENG[settingDate.getMonth() + 1];
        let dd2 = settingDate.getDate(); dd2 = (dd2 < 10) ? '0' + dd2 : dd2;
        
        pathOne = `${FILE_PATH}/${yy2}/${mm2}/${dd2}`
        dateDir.push(pathOne);
    }

    fileList = await concatFileArr(dateDir);
    fileList.sort(compStringReverse);
    
    /*
    const nowDate = new Date();
    const yy = nowDate.getFullYear();
    const mm = DATE_TO_ENG[nowDate.getMonth() + 1];
    let dd = nowDate.getDate(); dd = (dd < 10) ? '0' + dd : dd;

    let path = `${FILE_PATH}/${yy}/${mm}/${dd}`;
    */

    for (const item of fileList) {
        let temp = {};
        temp = await editFiles(item);
        fileTempInfo.unshift(temp);
    };

    FILE_INFO_LIST = fileTempInfo;
};

/* 
    @author onlyhisson
    @param  string fileName 파일 이름
    @return 해당 파일의 이름, 크기, 생성일, md5 데이터 Object
    @note 파일 정보 edit
*/
async function editFiles(fileName) {
    const dateArr = fileName.split('-');
    const fileFullName = `${FILE_PATH}/${dateArr[2].substring(0,4)}/${dateArr[1]}/${dateArr[0]}/${fileName}`
    const fileInfo = await getFileInfo(fileFullName);
    const hash = await fileHash(fileFullName, 'md5');
    const jsonObj = {
        fileName: fileName,
        size: fileInfo.size,
        md5: hash,
        date: fileInfo.birthtimeMs
    };
    return jsonObj;
};

// 일자별 파일명 배열 합쳐서 return 
async function concatFileArr(array) {
    let fileArr = [];
    for (const item of array) {
      let result = await getFileList(item);
      fileArr = fileArr.concat(result);
    };
    return fileArr
};

// 내림차순 옵션
function compStringReverse(a, b) {
    if (a > b) return -1;
    if (b > a) return 1;
    return 0;
};  

/* 해당 경로 폴더 내 파일 리스트 return  */
function getFileList(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, function (error, fileList) {
            if(error && error.code == 'ENOENT') {
                resolve([])
            } 
            if (error) {     
                reject(error);
            } else {
                resolve(fileList);
            }
        });
    });
}

/* 파일 hash 데이터 */
function fileHash(fileName, algorithm) {
    
    return new Promise((resolve, reject) => {
        // Algorithm depends on availability of OpenSSL on platform
        // Another algorithms: 'sha1', 'md5', 'sha256', 'sha512' ...
        let shasum = crypto.createHash(algorithm);
        try {
            let s = fs.ReadStream(fileName)
            s.on('data', function (data) {
                shasum.update(data)
            })
            // making digest
            s.on('end', function () {
                const hash = shasum.digest('hex')
                return resolve(hash);
            })
        } catch (error) {
            console.log(error);
            return reject('calc fail');
        }
    });
}

/* 파일 정보 */
function getFileInfo(fileName) {
    return new Promise((resolve, reject) => {
        fs.stat(fileName, (err, stats) => {
            if (err) {
                return reject(err);
            }
            // console.log(stats);          				            // 파일 정보
            // console.log("isFIle : " + stats.isFile());               // 파일 여부
            // console.log("isDirectory : " + stats.isDirectory());     // 디렉토리 여부
            // console.log("isBlockDevice : " + stats.isBlockDevice()); // 블럭타입의 기기 여부
            // console.log("isCharacterDevice : " + stats.isCharacterDevice()); // 문자타입의 기기 여부
            // console.log("isSymbolicLink : " + stats.isSymbolicLink());       // 심볼릭 링크 여부
            // console.log("isFIFO : " + stats.isFIFO());				        // FIFO(유닉스 네임드 파이프) 여부
            // console.log("isSocket : " + stats.isSocket());			        // 도메인 소켓 여부
            return resolve({
                birthtimeMs: formatdateBasic(stats.birthtimeMs),
                size: stats.size
            })
        });
    })
}


/* 
    @author onlyhisson
    @param  string dir 파일 경로
    @param  array files_ 경로 내 파일 리스트
    @return array path 하위 모든 파일 리스트
    @note   dir path 하위 모든 파일 조회
*/
async function getFiles (dir, files_) {
    files_ = files_ || [];
    let files = fs.readdirSync(dir);
    for (let i in files) {
        let name = dir + '/' + files[i];
        if(fs.statSync(name).isDirectory()) {
            getFiles(name, files_);
        } else {
            files_.push(name);
        }
    }
    return files_;
};

/* 
    @author onlyhisson
    @param  string dir 파일 경로
    @param  array files_ 경로 내 파일 리스트
    @return string path 하위 1개 파일
    @note   dir path 하위 1개 파일
*/
async function getFileOne (dir) {
    let fileArr = [];
    const files = fs.readdirSync(dir);
    for (let i in files) {
        let name = dir + '/' + files[i];
        if(fs.statSync(name).isFile()) {
            fileArr.push(name);
        }
    }
    return fileArr[0];
};


function formatdateBasic(timeStamp) {
    const d = new Date(timeStamp);

    yy = d.getFullYear();
    mm = d.getMonth() + 1; mm = (mm < 10) ? '0' + mm : mm;
    dd = d.getDate(); dd = (dd < 10) ? '0' + dd : dd;
    hh = d.getHours(); hh = (hh < 10) ? '0' + hh : hh;
    mi = d.getMinutes(); mi = (mi < 10) ? '0' + mi : mi;
    se = d.getSeconds(); se = (se < 10) ? '0' + se : se;

    return '' + yy + '-' + mm + '-' + dd + ' ' + hh + ':' + mi + ':' + se;
};

/* 
    @author onlyhisson
    @param  object obj 응답할 JSON 데이터 
    @param  object res 응답 객체
*/
const responseHandler = (obj, res) => {
    if(process.env.DEV == 'Y') {
        res.json(obj);
    } else {
        res.jsonp(JSON.stringify(obj));
    }
};

/* 
    @author onlyhisson
    @param  object err 에러 객체 
    @param  object res 응답 객체
*/
const errorHandler = (err, res) => {
    const obj = {
        status: 1,
        error: {
            code: err.code || 'ERROR',
            msg: err.message || 'error'
        }
    };
    console.log('################# errorHandler start #################');
    console.log(obj);
    console.log('################# errorHandler end   #################');
    res.json(obj);
};

module.exports = router;