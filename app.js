const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { PassThrough } = require('stream');
const { urlencoded } = require('body-parser');
const path = require('path');
const { getMaxListeners } = require('process');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const req = require('express/lib/request');
const res = require('express/lib/response');
require('dotenv').config();


const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);


const app = express();
const port = process.env.port || 3000;


app.use(express.static(__dirname + '/public'));                         //Serving static files

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
  }));

app.use(session({
    secret : "Our little Seccret",
    resave : false,
    saveUninitialized : false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/todoDB");

const dateSchema = mongoose.Schema({
    year : Number,
    month : Number,
    day : Number
});

const todoSchema = mongoose.Schema({
    title : String,
    description : String,
    priority : Number,
    isDone : Boolean,
    createdOn : Date,
    tags : [String]
});

const Todo = mongoose.model("Todo", todoSchema);

const userSchema = mongoose.Schema({
    username : {
        type : String,
        required : true,
        unique : true
    },
    fullname : String,
    contactNo : Number,
    password : String,
    profesion : String,
    age: { 
        type: Number, 
        min: 8, 
        max: 65, 
        required: false
    },
    mytodos : [todoSchema]
});

userSchema.plugin(passportLocalMongoose);       //Hash and salt our password & save into mongodb

const User =  mongoose.model("User", userSchema);


passport.use(User.createStrategy());                     //Using passport to cretae session nd cookies
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// *************************************************** GET REQUESTS ******************************************************
app.get("/", function(req, res){
    res.render("pages/home");
})

app.get("/register", function(req, res){
    res.render("pages/register");
});

app.get("/login", function(req, res){
    res.render("pages/login");
});

app.get("/index", function(req, res){
    if(req.isAuthenticated()){
        const userId = req.session.passport.user;
        console.log(userId);

        User.findOne({username : userId}, function(err, userFound){
            if(err){
                console.log(err);
            }else if(userFound){
                const todoArr = userFound.mytodos;
                res.render("pages/index", {items : todoArr, counter : 0});
            }
        });
        
    }else{
        res.redirect("/login")
    }
});

app.get("/profile", function(req, res){
    if(req.isAuthenticated()){
        const userName = req.session.passport.user;
        console.log(userName);
        User.findOne({username : userName}, function(err, data){
            if(err){
                console.log(err);
            }else{
               // console.log(data);
                const fullName = data.fullname;
                const userName = data.username;
                const contactNo = data.contactNo;
                const userProfession = data.profesion;
                const age = data.age;
                res.render("pages/profile", {fullname : fullName, username : userName, age : age, contactNo : contactNo, profession : userProfession});
            }
        });
    }else{
        res.redirect("/login");
    }
   
});

app.get("/report", function(req, res){
    User.findOne({username : req.session.passport.user}, function(err, userFound){
        if(err){
            console.log(err);
        }else if(userFound){
            //  console.log(userFound);
            var tot = 0;
            var done = 0;

            var todaysTot = 0;
            var todaysDone = 0;

            const todaysDate = new Date();
            const todays_day = todaysDate.getDate();
            const todays_month = todaysDate.getMonth();
            const todays_year = todaysDate.getFullYear();

            const todoArr = userFound.mytodos;
            tot = todoArr.length;
            for(let i=0; i<tot; i++){
                if(todoArr[i].isDone === true){
                    done++;
                }
                const createdDate = todoArr[i].createdOn;
                const created_day = createdDate.getDate();
                const created_month = createdDate.getMonth();
                const created_year = createdDate.getFullYear();
                if(todays_day === created_day && todays_month === created_month && todays_year === created_year){
                   todaysTot++;
                   if(todoArr[i].isDone === true){
                       todaysDone++;
                   }
                }
               
            }
            var undone = tot-done;
            var todaysUndone = todaysTot - todaysDone;
            res.render("pages/report", {total : tot, done : done, undone : undone, todaysTotal : todaysTot, todaysDone : todaysDone, todaysUndone : todaysUndone});
        }else{
            res.redirect("index");
        }
    })
});

app.get("/logout", function(req, res, next){
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });

    // res.sendFile(path.resolve('./public/logout.html'));
});


// *************************************************** POST REQUESTS ******************************************************
app.post("/register", function(req, res){
   // console.log(req.body);
    const username = req.body.username;
    const password = req.body.password;
    const passwordC = req.body.passwordC;
    const userfullName = req.body.fullname;
    const contact = req.body.contactNo;
    const userProfession = req.body.profession;
    const age = req.body.age;

    if(password != passwordC){
        console.log("Your password doesnt matches");
        res.redirect("/register");
    }else{
        User.register({username : username, fullname : userfullName, contactNo : contact, profesion : userProfession, age : age}, password, function(err, user){
            if(err){
                console.log(err);
                res.redirect("/register");
            }else{
                passport.authenticate("local")(req, res, function(){
                    console.log(req.session.cookie);
                    res.redirect("index");
                });
            }
        });
    }


    // if(password != passwordC){
    //     console.log("Your password doesnt matches");
    //     res.redirect("/register");
    // }
    // else{
    //     const newUser = new User({
    //         username : username,
    //         fullname : userfullName,
    //         contactNo : contact,
    //         password : password,
    //         profesion : userProfession,
    //         age : age,
    //         mytodos : []  
    //     });
    //     User.create(newUser, function(err, docInserted){
    //         if(err)
    //            console.log(err);
    //         else{
    //             console.log(docInserted);
    //             const id = docInserted._id;
    //             const objArr = docInserted.mytodos;
    //             res.render('pages/index', {items : objArr, userId : id});
    //         }
    //     });

    // }
});

app.post("/login", function(req, res){
    //console.log(req.body);
    const usernameText = req.body.username;
    const passwordText = req.body.password;
    // if(usernameText === "" || passwordText === ""){
    //     return res.redirect("login");
    // }
    const newUser = new User({
        username : usernameText,
        password : passwordText
    });
    //console.log(newUser);
    req.login(newUser, function(err){
        if(err){
            console.log(err);
        }else{
          
            passport.authenticate("local")(req, res, function(){
                //console.log(req.session.cookie);
                res.redirect("/index");
            });
        }
    });
    // User.findOne({username : usernameText}, function(err, userFound){
    //     if(err){
    //         console.log(err);
    //     }
    //     else{
    //         if(userFound){
    //             if(passwordText === userFound.password){
    //                 const objArr = userFound.mytodos;
    //                 const id = userFound._id;
    //                 res.render('pages/index', {items : objArr, userId : id});
    //             }   
    //         }
    //         else{
    //             console.log("Your password is Wrong!")
    //             res.redirect("/login");
    //         }
    //     }
    // });
   
});

app.post("/index", function(req, res){

     const userName = req.session.passport.user;
    
     const tit = req.body.title;
     const descr = req.body.description;
     const priority = req.body.priority;
     const tagsDesc = req.body.tags;
     
     const newTodo = new Todo({
            title : tit,
            description : descr,
            priority : priority,
            isDone : false,
            createdOn : new Date(),
            tags : ["Work", "Study"]
        });
   
        User.findOne({username : userName}, function(err, userData){
           if(err){
               console.log(err);
               res.redirect("/index");
           }
           else if(userData){
              //console.log(userData._id);
              User.updateOne({username : userName}, { $push : {mytodos : newTodo} }, function(err){
                  if(err)
                     console.log(err);
                  else{
                   User.findOne({username : userName}, function(err, datas){
                       if(err)
                          console.log(err);
                        else{
                            res.redirect("/index");
                        }
                   });
                  }
              });
           
           }
        });
});

app.post("/profile", function(req, res){
    const userName = req.session.passport.user;
    // console.log(userName);
    // console.log(res.writable);
    User.updateOne({username : userName},
          {fullname : req.body.fullname, contactNo : req.body.mobile, age : req.body.age, profesion : req.body.profession}, function(err){
              if(err){
                  console.log(err);
              }else{
                  console.log("updated Successfully !");
                  res.redirect("/profile");
              }
          });
});

app.post("/delete", function(req, res){
    // console.log(req.body);  

    const userName = req.session.passport.user;
    //console.log(userName);
    const mytodoId = req.body.submit;

    User.updateOne({username : userName, "mytodos._id" : mytodoId}, {$set : {"mytodos.$.isDone" : true}}, function(err){
        if(err){
            console.log(err);
        }else{
            res.redirect("index");
        }
    });
});

app.post("/filter", function(req, res){
    const userName = req.session.passport.user;

    
    User.findOne({username : userName}, function(err, data){
        if(err){
            console.log(err);
        }else{
           if(req.body.check3 === 'todaysOnly')
           { 
                    const todo = data.mytodos
                    const newTodoArr = findTodaysOnlyFun(todo);
                    console.log(newTodoArr);
                    
                    if(req.body.check1 === "lowToHigh" && req.body.check2 === "highToLow"){
                        res.render("pages/index", {items : newTodoArr, counter : 0});
                    }
                    else if(req.body.check1 === "lowToHigh"){
                        todoLowToHighSort(newTodoArr);
                        res.render("pages/index", {items : newTodoArr, counter : 0});         
                    }
                    else if(req.body.check2 == "highToLow"){ 
                         todoHighToLowSort(newTodoArr);
                         console.log(newTodoArr)
                         res.render("pages/index", {items : newTodoArr, counter : 0})
                    }else{
                        res.render("pages/index", {items : newTodoArr, counter : 0});
                    }
        
           }
           else{
                const todoArr = data.mytodos;
                if(req.body.check1 === "lowToHigh" && req.body.check2 === "highToLow"){
                    res.render("pages/index", {items : todoArr, counter : 0});
                }
                else if(req.body.check1 === "lowToHigh"){
                    todoLowToHighSort(todoArr);
                    res.render("pages/index", {items : todoArr, counter : 0});         
                }
                else if(req.body.check2 == "highToLow"){ 
                    todoHighToLowSort(todoArr);
                    res.render("pages/index", {items : todoArr, counter : 0})
                }else{
                    res.render("pages/index", {items : todoArr, counter : 0});
                }
           }
        }
 });
});

app.post("/sendReport", function(req, res){
    const userName = req.session.passport.user;
    console.log(req.body);
    console.log(accountSid);
    console.log(authToken);
    console.log("Trying to send.....");
    if(req.body.btn1 === 'btn1'){
        console.log("Report will be sent on SMS ")
        // client.messages.create({
        //     body : "This is for Testiing Purpose",
        //     from : '+18645714463',
        //     to : '+91 62638 27695'   
        // })
        // .then((res)=>{console.log( res +" msg sent !")})
        // .catch((err)=>{console.log(err)});
    }else{
        console.log("Report will be sent on Email ");
        //Code to send report on mail
    }

    res.redirect("report");
})

app.listen(port, function(){
    console.log("https://localhost:${port}");
});

//FUnction To sort and desaggregat data

function findTodaysOnlyFun(todoArr){
    const today_date = new Date();
    const today_day = today_date.getDate();
    const today_month = today_date.getMonth();
    const today_year = today_date.getFullYear();

    let newTodoArr = [];
    for(let i=0; i<todoArr.length; i++){
        const createdOnDate = todoArr[i].createdOn;
        console.log(createdOnDate)
        const create_day = createdOnDate.getDate();
        const create_month = createdOnDate.getMonth();
        const create_year = createdOnDate.getFullYear();
        if(today_day===create_day && today_month===create_month && today_year===create_year){
            newTodoArr.push(todoArr[i]);
        }
    }
    return newTodoArr;
}


function todoHighToLowSort(todoArr){
    todoArr.sort(function(a, b){
        if(a.priority < b.priority)
           return 1;
        else
            return  -1;
    });
    return todoArr;
}

function todoLowToHighSort(todoArr){
    todoArr.sort(function(a, b){
        if(a.priority < b.priority)
           return -1;
        else
            return  1;
    });
    return todoArr;
}
