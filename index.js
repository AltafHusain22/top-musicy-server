const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

// middleware
app.use(cors());
app.use(express.json());
const bodyParser = require("body-parser");
// Parse JSON bodies
app.use(bodyParser.json());

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

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-3omtg6q-shard-00-00.p9nxh9h.mongodb.net:27017,ac-3omtg6q-shard-00-01.p9nxh9h.mongodb.net:27017,ac-3omtg6q-shard-00-02.p9nxh9h.mongodb.net:27017/?ssl=true&replicaSet=atlas-jiv18x-shard-0&authSource=admin&retryWrites=true&w=majority`;

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
    // TODO: have to be remove below line when upload to vercel
    // await client.connect();
    const usersCollection = client.db("topMusicy").collection("topMusicyUsers");
    const classCollection = client.db("topMusicy").collection("classes");
    const paymentsCollection = client.db("topMusicy").collection("payments");
    const usersClassCollection = client
      .db("topMusicy")
      .collection("selectedClasses");

    // create jwt api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN);
      res.send({ token });
    });

    // verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // user related api//
    //------------------------------------------------------//

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
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get a specific admin api
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // get a specific instructor api
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // get a specific instructor api
    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ user: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { user: user?.role === "user" };
      res.send(result);
    });

    // instructor related api//
    //------------------------------------------------------//

    // addclass by instructor
    app.post("/addclass", async (req, res) => {
      const classBody = req.body;
      const result = await classCollection.insertOne(classBody);
      res.send(result);
    });

    // update classcollection by admin feedback
    app.patch("/insertFeedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get all classess that added by instructor

    app.get("/myclasses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // update class
    app.patch("/myclasses/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      console.log(body);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: body,
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // class related api//
    //------------------------------------------------------//

    // get all classes
    app.get("/allclasses", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // get all approved class to show class page
    app.get("/approvedclass", async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // get top classes to show home page
    app.get("/classes/top", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ seat: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // admin task api//
    //------------------------------------------------------//
    // class status update to approved
    app.patch("/class/:status", async (req, res) => {
      const status = req.params.status;
      const filter = { status: status };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // class status update to denied
    app.patch("/deny/:deny", async (req, res) => {
      const status = req.params.deny;
      console.log(status);
      const filter = { status: status };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // set user role to an Admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // set user role to an instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // delete a specific user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    // student-class related api//
    //------------------------------------------------------//
    //  selected classe insert to db

    app.post("/userselectedclass", async (req, res) => {
      const body = req.body;
      body._id = new ObjectId();
      const result = await usersClassCollection.insertOne(body);
      res.send(result);
    });

    // get selected classes from db by spesific student
    app.get("/selectedClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { UserEmail: email };
      const result = await usersClassCollection.find(query).toArray();
      res.send(result);
    });

    //  delete class by student
    app.delete("/class/:id", async (req, res) => {
      const id = req.params.id;
      query = { _id: new ObjectId(id) };
      const result = await usersClassCollection.deleteOne(query);
      res.send(result);
    });

    // my enrolled classes and payment history by decending order
    app.get("/enrolledclasses", async (req, res) => {
      const result = await paymentsCollection.find().sort({ transectionId: -1 }).toArray();
      res.send(result);
    });

    // todo: its not working have to be fix
    //  update available seat and enrolled api after select
    app.patch("/update-seat/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
    
      const filter = { _id: new ObjectId(id) };
      console.log(filter);
    
      try {
        // Retrieve the class document from the database
        const classDoc = await classCollection.findOne(filter);
        // Update the seat and enrolled count
        const updateDoc = {
          $set: {
            seat: classDoc.seat - 1,
            enrolled: classDoc.enrolled + 1,
          },
        };
    
        const result = await classCollection.updateOne(filter, updateDoc);
    
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Error updating seat", error });
      }
    });
    

    // payment related api//
    //------------------------------------------------------//

    // create-payment-intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // post payment history to db
    app.post("/paymenthistory", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      res.send(result);
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
