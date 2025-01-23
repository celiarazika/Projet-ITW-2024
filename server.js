import express from 'express';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import * as indexRoute from "./routes/index.js";
import * as contribuerRoute from "./routes/contribuer.js";
import * as randoRoute from "./routes/rando.js";
import * as signUpRoute from "./routes/sign-up.js";
import * as loginRoute from "./routes/login.js";
import { hashPassword } from "./lib/hash-password.js";
import { open } from 'sqlite';
const app = express();
const bdComptes = './comptes.sqlite';
app.use(express.static('.'));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use('/static', express.static('public'))
app.get('/', indexRoute.get);
//Pour que l'utilisateur n'ait accès à cette page seulement s'il est connecté:
//app.get('/contribuer', requireLogin, contribuerRoute.get);
//avec le middleware:
//function requireLogin(request, response, next) {
//  if (request.context.user) {
//    next();
//  } else {
//    response.redirect("/connexion");
//  }
app.get('/contribuer', contribuerRoute.get);
app.get('/connexion', loginRoute.get);
app.get('/inscription', signUpRoute.get);


  /*app.use(
    cookieSession({
      keys: [sessionKey],
      maxAge: sessionMaxAge,
      sameSite: "strict",
    }),
  );
  app.use((request, response, next) => {
    const username = request.session?.username;
    if (typeof username !== "string") {
      next();
      return;
    }
    request.context.database
      .prepare("SELECT username FROM users WHERE username = ?")
      .then((statement) => statement.get(request.session.username))
      .then((user) => {
        request.context = request.context ?? {};
        request.context.user = user;
        next();
      })
      .catch((error) => {
        console.error("Error loading user from session", error);
        request.session = null;
        next();
      });
  });*/


let connectComptes = new sqlite3.Database('./comptes.sqlite', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the comptes database.');
});
let connect = new sqlite3.Database('./randonnees.sqlite', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the randonnees database.');
});
function isNonEmptyString(value) {
  return typeof value === "string" && value !== "";
}
app.post('/connexion', (request, response) => {
     const { username, password, checkbox } = request.body;
  if (
    !isNonEmptyString(username) ||
    !isNonEmptyString(password) ||
    !checkbox) {
    response.status(400).end();
    return;
  }
  Promise.all([
    request.context.bdComptes.prepare(
      "INSERT INTO users (username, password) VALUES (?, ?, ?)",
    ),
    hashPassword(password),
  ])
    .then(([statement, hashedPassword]) => {
      return statement.run(username, hashedPassword);
    })
    .then(() => {
      request.session = request.session ?? {};
      request.session.username = username;
      response.end();
    })
    .catch((error) => {
      if (error.message.includes("UNIQUE constraint failed")) {
        response.status(409).end();
      } else {
        console.error("Error signing up", error);
        response.status(500).end();
      }
    });
});
app.post('/contribuer', (req, res) => {
    const { nom, adresse, desc, photo } = req.body;

    console.log('Received data:', req.body); // log received data

    if (!nom || !adresse || !desc || !photo) {
        console.log("Merci de remplir toutes les informations.");
        return;
    }

    const stmt = connect.prepare("INSERT INTO randonnees(nom,adresse,desc,photo) values(?,?,?,?)");
    stmt.run(nom, adresse, desc, photo, function(err) {
    if (err) {
        return console.error(err.message);
    }
    console.log(`Row inserted ${this.lastID}`);
    });
    stmt.finalize();

        console.log('Insert successful'); 

        res.redirect(`/randonnees/page/${nom}`);
    });

app.get('/randonnees', (req, res) => {
    connect.all("SELECT * FROM randonnees", [], (err, result) => {
        if (err) {
            throw err;
        }
        res.json(result);
    });
});

app.get('/randonnees/:nom', (req, res) => {
    const nom = req.params.nom;
    connect.get("SELECT * FROM randonnees WHERE nom = ?", [nom], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: 'Randonnee introuvable' });
        }
    });
});

app.get('/randonnees/page/:nom', randoRoute.get);
app.listen(3000, () => {
    console.log('Server started on port 3000');
});