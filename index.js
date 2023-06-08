const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

// jwt middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(403).send({ error: true, message: "forbidden Access" });
  }
  // bearar token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

// mongo db

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p9nxh9h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // TODO: have to be remove below line
    await client.connect();
    const usersCollection = client.db("topMusicy").collection("topMusicyUsers");
  
    // user related api
    //------------------------------------------------------
    // post users to db
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ Message: "User Already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get all users
    app.get('/users', async(req, res) => { 
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    //   set user role to an Admin 
    app.patch('/users/admin/:id', async(req, res) => { 
      const id = req.params.id 
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    //   set user role to an instructor 
    app.patch('/users/instructor/:id', async(req, res) => { 
      const id = req.params.id 
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    //   delete a spesific user 
    app.delete('/users/:id', async(req, res) => { 
      const id = req.params.id 
      const filter = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(filter)
      res.send(result)
    })

   
    // stripe payment related api
    // ------------------------------------------------
    // create-payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });



    // -----------------------------------------------

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
