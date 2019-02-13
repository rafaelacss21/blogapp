var bodyParser            = require("body-parser"),
    methodOverride        = require("method-override"),
    expressSanitizer      = require("express-sanitizer"),
    mongoose              = require("mongoose"),
    express               = require("express"),
    flash                 = require("connect-flash"),
    passport              = require("passport"),
    LocalStrategy         = require("passport-local"),
    passportLocalMongoose = require("passport-local-mongoose"),
    app                   = express(),
    Blog                  = require("./models/blog"),
    Comment               = require("./models/comment"),
    User                  = require("./models/user");

// APP CONFIG
//mongoose.connect("mongodb://localhost/restful_blog_app");
mongoose.connect("mongodb+srv://RafaAdm:<209215*rafa>@cluster0-qddif.mongodb.net/restful_blog_app?retryWrites=true");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressSanitizer());
app.use(methodOverride("_method"));


app.use(require("express-session")({
    secret: "I love my mom!",
    resave: false,
    saveUninitialized: false
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// pass currentUser username to all routes
app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

//////////////////
// BLOG ROUTES //
////////////////

// RESTFUL ROUTES
app.get("/", function(req, res){
   res.redirect("/blogs"); 
});

// INDEX ROUTE
app.get("/blogs", function(req, res){
   Blog.find({}, function(err, blogs){
       if(err){
           console.log("ERROR!");
       } else {
          res.render("blogs/index", {blogs: blogs}); 
       }
   });
});

// NEW ROUTE - show the form to create a new post
app.get("/blogs/new", isLoggedIn, function(req, res){
    res.render("blogs/new");
});

// CREATE ROUTE - create and add a new post to the database
app.post("/blogs", isLoggedIn, function(req, res){
    var title = req.body.title;
    var image = req.body.image;
    var content = req.body.content;
    var created = req.body.created;
    var author = {
        id: req.user._id,
        username: req.user.username
    };
    var newBlog = {title: title, image: image, content: content, created: created, author:author};
    Blog.create(newBlog, function(err, newlyBlog){
        if(err){
            res.render("blogs/new");
        } else {
            //then, redirect to the page of the post created
            res.redirect("/blogs/" + newlyBlog._id);
        }
    });
});

// SHOW POST ROUTE - show more info about a post
app.get("/blogs/:id", function(req, res){
   Blog.findById(req.params.id).populate("comments").exec(function(err, foundBlog){
       if(err){
           res.redirect("/blogs");
       } else {
           //console.log(foundBlog);
           res.render("blogs/show", {blog: foundBlog});
       }
   });
});

// EDIT POST ROUTE - allows you to edit a post
app.get("/blogs/:id/edit", checkBlogOwner, function(req, res){
        Blog.findById(req.params.id, function(err, foundBlog){
            if(err){
                req.flash("error", err.message);
            } else {
                res.render("blogs/edit", {blog: foundBlog});
            }
        });
});

// UPDATE POST ROUTE - allows you to update a post
app.put("/blogs/:id", checkBlogOwner, function(req, res){
    var newData = {name: req.body.name, image: req.body.image, content: req.body.content};
    //req.body.blog.content = req.sanitize(req.body.blog.content)
   Blog.findByIdAndUpdate(req.params.id, {$set: newData}, function(err, updatedBlog){
      if(err){
          res.redirect("/blogs");
      }  else {
          res.redirect("/blogs/" + req.params.id);
      }
   });
});

// DELETE ROUTE - allows you to delete a post
app.delete("/blogs/:id", checkBlogOwner, function(req, res){
   //destroy blog
   Blog.findByIdAndRemove(req.params.id, function(err){
       if(err){
           res.redirect("/blogs");
       } else {
           res.redirect("/blogs");
       }
   });
});


//////////////////////
// COMMENTS ROUTES //
////////////////////

// NEW COMMENT
app.get("/blogs/:id/comments/new", isLoggedIn, function(req, res){
    // find blog by id
    Blog.findById(req.params.id, function(err, blog){
        if(err){
            req.flash("error", err.message);
        }else {
            res.render("comments/new", {blog: blog});
        }
    });
});

app.post("/blogs/:id/comments", isLoggedIn, function(req, res){
    // look for blog using ID
    Blog.findById(req.params.id, function(err, blog){
        if(err){
            //console.log(err);
            res.redirect("/blogs");
        } else {
            Comment.create(req.body.comment, function(err, comment){
                if(err){
                    req.flash("error", err.message);
                } else {
                    // add username and id to comment
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    // save comment
                    comment.save();
                    blog.comments.push(comment);
                    blog.save();
                    req.flash("success", "Comment successfuly added!")
                    res.redirect("/blogs/" + blog._id);
                }
            });
        }
    });
});

// EDIT COMMENT
app.get("/blogs/:id/comments/:commentId/edit", isLoggedIn, function(req, res){
    // find campground by id
    Comment.findById(req.params.commentId, function(err, comment){
        if(err){
            req.flash("error", err.message);
        } else {
              res.render("comments/edit", {blog_id: req.params.id, comment: comment});
        }
    });
});

// UPDATE COMMENT
app.put("/blogs/:id/comments/:commentId", function(req, res){
   Comment.findByIdAndUpdate(req.params.commentId, req.body.comment, function(err, comment){
       if(err){
           res.render("edit");
       } else {
           res.redirect("/blogs/" + req.params.id);
       }
   }); 
});

// DELETE COMMENT
app.delete("/blogs/:id/comments/:commentId", function(req, res){
    Comment.findByIdAndRemove(req.params.commentId, function(err){
        if(err){
            res.redirect("back");
        } else {
            req.flash("success", "Comment successfuly deleted!")
            res.redirect("/blogs/" + req.params.id);
        }
    })
});


//////////////////
// USER ROUTES //
////////////////

// SHOW SIGN UP/REGISTER FORM
app.get("/register", function(req, res){
   res.render("register"); 
});

// HANDLE USER SIGN UP
app.post("/register", function(req, res){
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            req.flash("error", err.message);
            return res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function(){
          req.flash("success", "Successfully signed up! Nice to meet you " + req.body.username);
          res.redirect("/blogs"); 
        });
    });
});

// SHOW LOGIN FORM
app.get("/login", function(req, res){
   res.render("login"); 
});

// HANDLE USER LOGIN
app.post("/login", passport.authenticate("local", {
        successRedirect: "/blogs",
        failureRedirect: "/login"
    }), function(req, res){
});

// LOGOUT ROUTE
app.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "Successfully logged out!");
   res.redirect("/blogs");
});


//////////////////
// MIDDLEWARES //
////////////////

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "Please Login first!");
    res.redirect("/login");
}

function checkBlogOwner(req, res, next){
    // check if user is logged in
    if(req.isAuthenticated()){
        Blog.findById(req.params.id, function(err, foundBlog){
            if(err){
                res.redirect("back");
            } else {
                // check if user own the post he is trying to edit
                if(foundBlog.author.id.equals(req.user._id)){
                    next();
                } else {
                    res.redirect("back");
                }
            }
        });
    } else {
        res.redirect("back");
    }
}


app.listen(process.env.PORT, process.env.IP, function(){
    console.log("SERVER IS RUNNING!");
});