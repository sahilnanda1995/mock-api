const express = require("express");
// const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
// const mongoSanitize = require("express-mongo-sanitize");
// const xss = require("xss-clean");
// const hpp = require("hpp");
const cors = require("cors");

const validatorInfo = require("./data/valInfo.json");
const riskscore = require("./data/riskscore.json");

// const userRoutes = require("./routes/userRoutes");
const globalErrHandler = require("./controllers/errorController");
const AppError = require("./utils/appError");
const app = express();

// Allow Cross-Origin requests
app.use(cors());

// Set security HTTP headers
app.use(helmet());

// console.log(validatorInfo)
// console.log(riskscore)

// Limit request from the same API
// const limiter = rateLimit({
//     max: 150,
//     windowMs: 60 * 60 * 1000,
//     message: 'Too Many Request from this IP, please try again in an hour'
// });
// app.use('/api', limiter);
const data = validatorInfo.map((x) => {
    const totalStake = x.totalStake;
    // console.log(totalStake)
    const poolReward = x.rewards[0].poolReward / Math.pow(10, 12);
    const commission = x.commission / Math.pow(10, 12);
    const rewardsPer100KSM =
        (poolReward - commission) * (100 / (totalStake + 100));
    // console.log(x.name)
    const rs = riskscore.filter((y) => {
        if (y.stashId == x.stashId) {
            // console.log(y.stashId)
            return y;
        }
    });
    // console.log(rs)
    const name = x.name == undefined ? "" : x.name;
    return {
        estimatedPoolReward: poolReward,
        totalStake: totalStake,
        commission: commission,
        stashId: x.stashId,
        name: name,
        riskscore: rs[0].riskScore,
        numOfNominators: x.noOfNominators,
        rewardsPer100KSM: rewardsPer100KSM,
    };
});

sortedData = data
    .sort(function (a, b) {
        return a.rewardsPer100KSM - b.rewardsPer100KSM;
    })
    .reverse();

// console.log(sortedData)

function sortLowRisk(arr) {
    const lowestRiskset = arr.filter((x) => x.riskscore < 0.3);
    // console.log(lowestRiskset)
    const medRiskSet = arr.filter(
        (x) => x.riskscore >= 0.3 && x.riskscore < 0.5
    );
    // console.log(medRiskSet)
    const lowMedSet = lowestRiskset.concat(medRiskSet);
    const remaining = arr.filter((n) => !lowMedSet.includes(n));
    const result = lowMedSet.concat(remaining);
    return result;
}

function sortMedRisk(arr) {
    const medRiskSet = arr.filter((x) => x.riskscore < 0.5);
    // console.log(medRiskSet)
    const remaining = arr.filter((n) => !medRiskSet.includes(n));
    const result = medRiskSet.concat(remaining);
    return result;
}

const lowRiskSortArr = sortLowRisk(sortedData);
const medRiskSortArr = sortMedRisk(sortedData);

app.get("/rewards/max-set", (req, res) => {
    try {
        if (!(sortedData.length > 0)) {
            res.json([]);
            return;
        }
        // console.log(sortedData);
        const result = sortedData
            .slice(0, 16)
            .map(
                ({
                    stashId,
                    name,
                    commission,
                    totalStake,
                    estimatedPoolReward,
                }) => ({
                    stashId,
                    name,
                    commission,
                    totalStake,
                    estimatedPoolReward,
                })
            );
        // console.log(result)
        res.json(result);
    } catch (err) {
        res.status(400).send({ error: "Error", err: err });
    }
});

app.get("/rewards/risk-set", (req, res) => {
    try {
        if (!(sortedData.length > 0)) {
            res.json([]);
            return;
        }

        // console.log(sortedData)
        const lowriskset = lowRiskSortArr.slice(0, 16);
        const medriskset = medRiskSortArr.slice(0, 16);
        const highriskset = sortedData.slice(0, 16);
        // console.log(result)
        result = [
            { lowriskset: lowriskset },
            { medriskset: medriskset },
            { highriskset: highriskset },
            { totalset: sortedData },
        ];
        res.json(result);
    } catch (err) {
        res.status(400).send({ error: "Error", err: err });
    }
});

app.get("/validators", (req, res) => {
    try {
        if (!(sortedData.length > 0)) {
            res.json([]);
            return;
        }
        // console.log(sortedData);
        const result = sortedData.map(
            ({
                stashId,
                name,
                commission,
                totalStake,
                estimatedPoolReward,
                numOfNominators,
            }) => ({
                stashId,
                name,
                commission,
                totalStake,
                estimatedPoolReward,
                numOfNominators,
            })
        );
        // console.log(result)
        res.json(result);
    } catch (err) {
        res.status(400).send({ error: "Error", err: err });
    }
});

// Body parser, reading data from body into req.body
// app.use(express.json({
//     limit: '15kb'
// }));

// Data sanitization against Nosql query injection
// app.use(mongoSanitize());

// Data sanitization against XSS(clean user input from malicious HTML code)
// app.use(xss());

// Prevent parameter pollution
// app.use(hpp());

// Routes
// app.use('/api/v1/', userRoutes);

// handle undefined Routes
app.use("*", (req, res, next) => {
    const err = new AppError(404, "fail", "undefined route");
    next(err, req, res, next);
});

app.use(globalErrHandler);

module.exports = app;
