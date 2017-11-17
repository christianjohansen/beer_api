const express = require('express')
const app = express()
const fs = require("fs");
const convert = require('convert-units')
var BodyParser = require("body-parser");

app.use(BodyParser.urlencoded({ extended: false }))
app.use(BodyParser.json())

var mysql = require('mysql')
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'root',
  database : 'beer'
});
var result;

var mssql = require("mssql");

mssql.connect(config, function (err) {
    if (err) console.log(err);
    /*var request = new mssql.Request();
    (new mssql.Request()).query('select * from test', function (err, recordset) {
        if (err) console.log(err)
        //res.send(recordset);
      console.log(recordset);
    });*/
});          

connection.connect(function (err,db) {
  app.listen(3000, function () {
    console.log('beer running on port 3000')
  })
});

// ------------------------------------------------------------------------

var recipe = {
  "weight_unit": "g",
  "liquid_unit": "l",
  "temperature_unit": "C",
  "id": 0,
  "yeast_id": 0,
  "brewer_id": 0,
  "beerstyle_id": 0,
  "volume": 0,
  "efficiency": 0,
  "mash_schedule": "",
  "boil_volume": 0,
  "hop_util_model": 0,
  "name": "",
  "added": "0000-00-00",
  "rating": 0,
  "comment": "",
  "units": "eu",
  "hop_used": [],
  "malt_used": [],
  "fermentation": [],
  "mash": []
}

// ------------------------------------------------------------------------

test = {6:"very pale",8:"pale yellow",12:"golden",18:"amber",28:"deep amber / light copper",34:"copper / reddish brown",36:"deep copper / light brown",44:"brown",60:"dark brown",70:"very dark brown",999:"black"}

utils = {"n/a":0,90:31,60:30,45:21,30:14,15:10,10:7,5:5,1:1,"dry":0}

// ------------------------------------------------------------------------

app.get('/recipe/:units/:id/:volume', function (req, res) {
  var units = req.params.units;
  var id = req.params.id;
  var volume = req.params.volume;
  
  if ( id != '-' ) getRecipe(res,units,id,volume);
  else {
    var temp = connection.query('INSERT INTO recipe SET ?', {added: new Date()}, function(err, result) {

      recipe.added = new Date();
      recipe.id = result.insertId;
      res.send(recipe);
    });
  }
})

app.get('/test', function (req, res) {
  res.send([{"test":"hans","test2":[{"a":"1"},{"a":"2"}]},{"test":"mads","test2":[{"a":"3"},{"a":"4"},{"a":"5"} ]} ]);
})

app.get('/hop', function (req, res) {
  (new mssql.Request()).query('SELECT id,name FROM hop', function (err, rows, fields) {
    res.send(rows.recordset);
  })
})

app.get('/malt', function (req, res) {
  connection.query('SELECT id,name FROM malt', function (err, rows, fields) {
    res.send(rows);
  })
})

app.post('/recipe', function (req, res) { 
  var body = req.body;  

  var temp = connection.query('INSERT INTO recipe SET ?', {added: new Date()}, function(err, result) {
    res.send("ok");
  })
  
})

function getRecipe(res,units,id,volume) {
  /*result = {
    "weight_unit":"g",
    "liquid_unit":"l",
    "temperature_unit":"C",
  };*/
  result = {};

  connection.query("SELECT * FROM recipe WHERE id="+id, function (err1, rows1, fields1) {
    result.recipe = rows1[0];
    connection.query('SELECT * FROM brewer WHERE id='+rows1[0].brewer_id, function (err2, rows2, fields2) {
      result.recipe.brewer = rows2[0].name;
      let sql = 'SELECT * FROM hop_used INNER JOIN hop2 ON hop2.id=hop_used.hop_id WHERE recipe_id='+rows1[0].id;
      connection.query(sql, function (err3, rows3, fields3) {
        result.recipe.hop_used = rows3;
        let sql = 'SELECT * FROM malt_used INNER JOIN malt2 ON malt2.id=malt_used.malt_id WHERE recipe_id='+rows1[0].id;
        connection.query(sql, function (err4, rows4, fields4) {
          result.recipe.malt_used = rows4;
          connection.query('SELECT * FROM yeast WHERE id='+rows1[0].yeast_id, function (err5, rows5, fields5) {
            result.recipe.yeast = rows5[0].name;
            connection.query('SELECT * FROM fermentation WHERE recipe_id='+rows1[0].id, function (err6, rows6, fields6) {
              result.recipe.fermentation = rows6;
              connection.query('SELECT * FROM beerstyle WHERE id='+rows1[0].beerstyle_id, function (err7, rows7, fields7) {
                result.recipe.beerstyle = rows7[0].name;
                connection.query('SELECT * FROM mash WHERE recipe_id='+rows1[0].id, function (err8, rows8, fields8) {
                  result.recipe.mash = rows8;

                  /*result.recipe.weight_unit = "g";
                  result.recipe.liquid_unit = "l";
                  result.recipe.temperature_unit = "C";*/

                  if ( volume != '-' ) calcNewVolume(result,volume); 
                  calcRecipe(result);
                  if ( units != '-' ) convertToUnits(result,units); 

                  res.send([result.recipe]);
                })
              })
            })
          })
        })
      })
    })
  })

}

function calcRecipe(data) {
  calcMalt(data); // malt before hop because some of the output is used in hop2
  calcHop(data);
  calcFinal(data);
}

function convertToUnits(data,to) {
  let temp = {"eu":["l","g","C"],"us":["gal","oz","F"]};
  data.recipe.weight_unit = temp[to][1];
  data.recipe.liquid_unit = temp[to][0];
  data.recipe.temperature_unit = temp[to][2];
  data.origin = to;
  data.recipe.volume = Number(convert( data.recipe.volume ).from(temp[data.recipe.units][0]).to(temp[to][0]).toFixed(1)); 
  for ( hop of data.recipe.hop_used ) hop.weight = Number(convert( hop.weight ).from(temp[data.recipe.units][1]).to(temp[to][1]).toFixed(1));
  for ( malt of data.recipe.malt_used ) malt.weight = Number(convert( malt.weight ).from(temp[data.recipe.units][1]).to(temp[to][1]).toFixed(1));
  for ( ferment of data.recipe.fermentation ) ferment.temperature = Math.round(convert( ferment.temperature ).from(temp[data.recipe.units][2]).to(temp[to][2]));
  for ( mash of data.recipe.mash ) mash.temperature = Math.round(convert( mash.temperature ).from(temp[data.recipe.units][2]).to(temp[to][2]));
}

function calcHop(data) {
  total_bitterness = 0;
  
  for ( hop of data.recipe.hop_used ) {
    //u = 1.65*Math.pow(0.000125, ((a.bg.value / 1000) - 1) )*(1-Math.exp(-0.04* boiltime ))/4.15;
    //a.util[i].value = parseInt(u * 1000 + 0.5) / 10;
    // ( ( 1.65 * Math.pow(0.000125, ((data.recipe.total_malt_gravity / 1000) - 1) ) * (1 - Math.exp( -0.04 * hop.boil )) / 4.15 ) * 1000 + 0.5 ) / 10;

    hop.utilisation = utils[hop.boil];
    // IBU = hops(g) * alpha(%) x utilisation(%) / (volume(L) * 10)
    hop.bitterness = Number( ( hop.weight * hop.alpha * hop.utilisation / (data.recipe.volume * 10) ).toFixed() );

    total_bitterness += hop.bitterness;
  }  
  data.recipe.total_bitterness = total_bitterness;
}

function calcMalt(data) {
  total_weight = 0;
  total_gravity = 1000;
  total_colour = 0;
  for ( malt of data.recipe.malt_used ) {
    // g = (a.weight[i].value * gravfactor[m] * eff / 100000 / a.volume.value);
    malt.gravity = Math.round( 1000 + malt.weight * malt.gravity_factor * data.recipe.efficiency / 100000 / data.recipe.volume );
    // 4.232
    // precise_mcu = (a.weight[i].value / 1000 * a.col[i].value / a.volume.value * mcu_from_ebc);
    malt.colour = Number( ( malt.weight / 1000 * malt.ebc / data.recipe.volume * 4.232 ).toFixed(1) );

    total_weight += malt.weight;
    total_gravity += (malt.gravity - 1000);
    total_colour += malt.colour;
  }
  data.recipe.total_malt_weight = total_weight;
  data.recipe.total_malt_gravity = total_gravity;
  data.recipe.total_malt_colour = total_colour;
  for ( malt of data.recipe.malt_used ) {
    malt.percent = Math.round( malt.weight / total_weight * 100 );
  }
  for (a in test) {
    if ( a > total_colour ) {
      data.recipe.colour_description = test[a];
      break;
    }
  }  
}

function calcNewVolume(data,new_volume) {
  ratio = data.recipe.volume / new_volume;
  data.recipe.volume = Number(new_volume);
  for ( hop of data.recipe.hop_used ) {
    hop.weight = hop.weight / ratio;
  }
  for ( malt of data.recipe.malt_used ) {
    malt.weight = malt.weight / ratio;
  }
}

function calcFinal(data) {
  data.recipe.final_gravity = Math.round( ( data.recipe.total_malt_gravity - 1000 ) * ( 1 - ( 75 / 100 ) ) + 1000 );
  data.recipe.alcohol = Number( ( ( data.recipe.total_malt_gravity - data.recipe.final_gravity ) / 7.63 ).toFixed(1) );
}


// --------------------------------------------------------------------



//connection.end()

/*
fs.readFile("yeast.html","utf8",function(err,data) {
  if ( err ) { return console.log(err); }
  console.log(data); 
});
*/

/*






app.get('/search/:search', function (req, res) {
	var search = req.params.search;
	console.log(search);

  db_connection.collection('hbo').find({$text:{$search:search}}).toArray(function (err, result) {
    if (err) handleError(res,err.message,"hejsa fejl");

    //console.log(req.param("hejsa"));

    res.send(result)
  })
})



app.post('/episode', function (req, res) { 
	var newdoc = req.body;
	//console.log(newdoc)

  db_connection.collection('hbo').insertOne(newdoc,function(err,result) {

    if (err) handleError(res,err.message,"gsdfgsdfg");
    res.json({"insertedCount": result.insertedCount,"insertedId":result.insertedId});

  	res.send(result)
	})
})

app.put('/episode', function (req, res) {
	var id = parseInt(req.body.id)
	var name = req.body.name;

  db_connection.collection('hbo').updateOne({"_id":id},{$set:{"name":name}}, function(err,result) {

    if (err) handleError(res,err.message,"gsdfgsdfg");

  	res.send(result)
  })
})


function handleError(res, reason, message, code) {
	console.log("error:"+reason);
	res.status(code || 500).json({"error":message});
}


*/