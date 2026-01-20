const mongoose = require("mongoose");
const dbConnect = require("./db/db.connect");
const express = require("express");
const Lead = require("./models/Leads.model");
const SalesAgent = require("./models/SalesAgent.model");
const Comment = require("./models/Comment.model");
const Tags = require("./models/Tags.model");
const cors = require("cors");
const app = express();

app.use(cors());

app.use(express.json());
dbConnect();

const validSources = [
  "Referral",
  "Website",
  "Cold Call",
  "Advertisement",
  "Email",
  "Other",
];

const validPriorities = ["High", "Medium", "Low"];

const validStatus = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Closed",
];

// Functions

async function insertLead(data) {
  try {
    const newLead = new Lead(data);
    const savedLead = await newLead.save();
    return savedLead;
  } catch (error) {
    console.log("Error while inserting lead");
    throw error;
  }
}

async function getLeads(filter) {
  try {
    const leads = await Lead.find(filter);

    return leads;
  } catch (error) {
    console.log("Error while fetching leads");
    throw error;
  }
}

async function getLeadById(id) {
  try {
    const lead = await Lead.findById(id);
    return lead;
  } catch (error) {
    console.log("Error while fetching lead");
    throw error;
  }
}

// Lead Api's

app.post("/v1/leads", async (req, res) => {
  try {
    const { name, source, salesAgent, status, timeToClose, priority } =
      req.body;

    if (!name) {
      return res
        .status(400)
        .json({ error: "Invalid input: 'name' is required." });
    }

    if (!source || !validSources.includes(source)) {
      return res.status(400).json({
        error: `Invalid input: 'source' is required and must be one of ${JSON.stringify(
          validSources
        )}.`,
      });
    }

    if (req.body.tags && req.body.tags.length > 0) {
      const finalTagIds = [];

      for (let tagName of req.body.tags) {
        let tag = await Tags.findOne({ name: tagName });

        if (!tag) {
          tag = await Tags.create({ name: tagName });
        }

        finalTagIds.push(tag._id);
      }

      req.body.tags = finalTagIds;
    }

    if (!priority || !validPriorities.includes(priority)) {
      return res.status(400).json({
        error: `Invalid input: 'priority' is required and must be one of ${JSON.stringify(
          validPriorities
        )}.`,
      });
    }

    if (!status || !validStatus.includes(status)) {
      return res.status(400).json({
        error:
          "Invalid input: 'status' is required and must be one of ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed'].",
      });
    }

    if (!timeToClose || timeToClose <= 0) {
      return res.status(400).json({
        error:
          "Invalid input: 'Time To close' is required and must be a positive integer.",
      });
    }

    if (salesAgent) {
      const agent = await SalesAgent.findOne({ _id: salesAgent });
      if (!agent) {
        return res.status(404).json({
          error: `Sales agent with ID '${salesAgent}' not found.`,
        });
      }
    }

    const newLeadData = req.body;
    const addedLead = await insertLead(newLeadData);

    await addedLead.populate("salesAgent", "name");

    return res.status(201).json(addedLead);
  } catch (error) {
    console.log("error while posting lead data", error);
    return res.status(500).json({
      error: "Server error while creating the lead",
    });
  }
});

app.get("/v1/leads", async (req, res) => {
  try {
    const { salesAgent, status, tags, source } = req.query;

    const filter = {};

    const hasFilters = salesAgent || status || tags || source;

    if (!hasFilters) {
      const allLeads = await Lead.find()
        .populate("salesAgent", "name")
        .populate("tags", "name");
      return res.json(allLeads);
    }

    if (salesAgent) {
      const agent = await SalesAgent.findById(salesAgent);
      if (!agent) {
        return res.status(400).json({
          error: `Sales agent with ID '${salesAgent}' not found.`,
        });
      }
      filter.salesAgent = salesAgent;
    }

    if (status) {
      if (!validStatus.includes(status)) {
        return res.status(400).json({
          error: `Invalid 'status'. Allowed values: ${validStatus.join(", ")}`,
        });
      }
      filter.status = status;
    }

    if (tags) {
      const tagsArray = tags.split(",");
      filter.tags = { $in: tagsArray };
    }

    if (source) {
      if (!validSources.includes(source)) {
        return res.status(400).json({
          error: `Invalid 'source'. Allowed values: ${validSources.join(", ")}`,
        });
      }
      filter.source = source;
    }

    const leads = await getLeads(filter)
      .populate("salesAgent", "name")
      .populate("tags", "name");

    res.json(leads);
  } catch (error) {
    console.log("Error while fetching leads", error);
    res.status(500).json({ message: error.message });
  }
});

app.put("/v1/leads/:id", async (req, res) => {
  const leadId = req.params.id;

  try {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const { name, source, salesAgent, status, timeToClose, priority } = req.body;

    if (name !== undefined && !name) {
      return res.status(400).json({ error: "'name' cannot be empty" });
    }

    if (source !== undefined && !validSources.includes(source)) {
      return res.status(400).json({
        error: `source must be one of ${JSON.stringify(validSources)}`,
      });
    }

    if (timeToClose !== undefined && timeToClose <= 0) {
      return res.status(400).json({
        error: "'timeToClose' must be a positive number",
      });
    }

    if (priority !== undefined && !validPriorities.includes(priority)) {
      return res.status(400).json({
        error: `priority must be one of ${JSON.stringify(validPriorities)}`,
      });
    }

    if (status !== undefined && !validStatus.includes(status)) {
      return res.status(400).json({
        error: `status must be one of ${JSON.stringify(validStatus)}`,
      });
    }

    if (salesAgent !== undefined && salesAgent !== null) {
      const agent = await SalesAgent.findById(salesAgent);
      if (!agent) {
        return res.status(404).json({
          error: `Sales agent with ID '${salesAgent}' not found.`,
        });
      }
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      leadId,
      req.body,
      { new: true }
    ).populate("salesAgent", "name");

    return res.status(200).json(updatedLead);

  } catch (error) {
    console.error("Error updating lead:", error);
    return res.status(500).json({ error: "Server error" });
  }
});


app.delete("/v1/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const isLeadIdValid = await Lead.findById(id);
    if (!isLeadIdValid)
      return res.status(400).json({ error: "Invalid lead ID" });

    const lead = await Lead.findByIdAndDelete(id);
    if (!lead)
      return res.status(404).json({ error: `Lead with ID '${id}' not found` });

    res.json({ message: "Lead deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sales Agent API's

app.post("/v1/agents", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name) return res.status(400).json({ error: "'name' is required" });

    if (!email || !email.includes("@"))
      return res.status(400).json({
        error: "Invalid input: 'email' must be a valid email address.",
      });

    const exists = await SalesAgent.findOne({ email });
    if (exists)
      return res
        .status(409)
        .json({ error: `Sales agent with '${email}' already exists` });

    const agent = await SalesAgent.create({ name, email });
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/v1/agents", async (req, res) => {
  try {
    const agents = await SalesAgent.find();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/v1/agents/:id', async (req, res)=>{
  const { id } = req.params;

  try {
    const agent = await SalesAgent.findById(id);

    if (!agent) {
      return res.status(404).json({
        error: "Sales agent not found",
      });
    }

    await Lead.updateMany(
      { salesAgent: id },
      { $set: { salesAgent: null } }
    );
    +

    await SalesAgent.findByIdAndDelete(id);

    res.status(200).json({
      message: "Sales agent deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete sales agent",
    });
  }
})


// Comment Api's

app.post("/v1/leads/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { commentText, author } = req.body;

    if (!commentText)
      return res.status(400).json({ error: "'commentText' is required" });

    const lead = await Lead.findById(id);
    if (!lead)
      return res
        .status(404)
        .json({ error: `Lead with ID "${lead}" not found.` });

    let comment = await Comment.create({ lead: id, commentText, author });

    comment = await comment.populate("author", "name");

    res.status(201).json({
      id: comment.lead,
      commentText: comment.commentText,
      author: comment.author,
      createdAt: comment.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/v1/leads/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const isLeadIdValid = await Lead.findById(id);
    if (isLeadIdValid) {
      let comments = await Comment.find({ lead: id }).populate(
        "author",
        "name -_id"
      );

      res.json(comments);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report Api's

app.get("/v1/report/last-week", async (req, res) => {
  try {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const leads = await Lead.find({
      status: "Closed",
      updatedAt: { $gte: lastWeek },
    });

    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/v1/report/pipeline", async (req, res) => {
  try {
    const count = await Lead.countDocuments({ status: { $ne: "Closed" } });
    res.json({ totalLeadsInPipeline: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tags Api's

app.get("/v1/tags", async (req, res) => {
  try {
    const readTags = await Tags.find();
    res.status(200).send(readTags);
  } catch {
    console.log("Error while fetching tags");
  }
});

// Port

app.listen(3000, () => {
  console.log("running on port 3000");
});
