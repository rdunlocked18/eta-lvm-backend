const db = require("../models");
const axios = require("axios").default;
const CryptoJS = require("crypto-js");
const { checkDuplicate } = require("../controllers/checkDuplicate");
const jwt = require("jsonwebtoken");
const MetaTrader = db.MetaTrader;
const Order = db.Order;

module.exports = function (app, passport) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });
    const User = db.User;

    app.post("/api/auth/signup", [checkDuplicate()], async (req, res) => {
        console.log(req.body);
        const email = req.body.email;
        const username = req.body.username;
        const phone = req.body.phone;
        const address = req.body.address;

        const hashedPass = CryptoJS.AES.encrypt(
            req.body.password,
            process.env.CRYPTO_SECRET
        ).toString();

        await User.create({
            username: username,
            email: email,
            password: hashedPass,
            phone: phone,
            address: address,
        })
            .then(async (result) => {
                const payload = { email: result.email };
                const token = jwt.sign(payload, process.env.SECRET);
                console.log(result);
                res.json({ msg: "login success", result, token });
            })
            .catch((err) => {
                console.log(err);
                return;
            });
    });
    //update user
    app.put(
        "/api/users/update",
        [passport.authenticate("user_auth", { session: false })],
        async (req, res) => {
            const id = req.user.id;
            const username = req.body.username;
            const phone = req.body.phone;
            const address = req.body.address;
            await User.update(
                {
                    username: username,
                    phone: phone,
                    address: address,
                },
                { where: { id: id } }
            )
                .then(() => {
                    res.json({ msg: "User updated successfully" });
                })
                .catch((err) => {
                    console.log(err);
                    res.json({ msg: ">> Error while updating data: ", err });
                });
        }
    );
    app.post("/api/auth/signin", async (req, res) => {
        const email = req.body.email;
        const password = req.body.password;
        await User.findOne({ where: { email: email } })
            .then(async (user) => {
                if (!user) {
                    res.json({
                        err: 404,
                        msg: "No user found with the requested email",
                    });
                } else {
                    const bytes = CryptoJS.AES.decrypt(
                        user.password,
                        process.env.CRYPTO_SECRET
                    );
                    const resultPassword = bytes.toString(CryptoJS.enc.Utf8);
                    if (resultPassword === password) {
                        const payload = { email: user.email };
                        const token = jwt.sign(payload, process.env.SECRET);
                        
                        const accountId = user.accountId;
                        const authtoken = process.env.META_AUTH_TOKEN;
            try {
                axios
                    .get(
                        `https://mt-client-api-v1.vint-hill.agiliumtrade.ai/users/current/accounts/${accountId}/orders`,
                        {
                            headers: {
                                "auth-token": authtoken,
                            },
                        }
                    )
                    .then(async (response) => {
                        console.log("response is",response.data);
                        for (let i = 0; i < response.data.length; i++) {
                            await Order.findAll({
                                where: { orderId: response.data[i].id },
                            })
                                .then(async (result) => {
                                    console.log(result[0].orderId);
                                    if (
                                        result[0].orderId ===
                                        response.data[i].id
                                    ) {
                                        console.log("already exists");
                                    } else {
                                        await Order.create({
                                            userId: req.user.id,
                                            orderId: response.data[i].id,
                                            platform: response.data[i].platform,
                                            type: response.data[i].type,
                                            state: response.data[i].state,
                                            symbol: response.data[i].symbol,
                                            magic: response.data[i].magic,
                                            time: response.data[i].time,
                                            brokerTime:
                                                response.data[i].brokerTime,
                                            openPrice:
                                                response.data[i].openPrice,
                                            volume: response.data[i].volume,
                                            currentVolume:
                                                response.data[i].currentVolume,
                                            positionId:
                                                response.data[i].positionId,
                                            reason: response.data[i].reason,
                                            currentPrice:
                                                response.data[i].currentPrice,
                                            accountCurrencyExchangeRate:
                                                response.data[i]
                                                    .accountCurrencyExchangeRate,
                                            brokerComment:
                                                response.data[i].brokerComment,
                                            stopLoss: response.data[i].stopLoss,
                                            takeProfit:
                                                response.data[i].takeProfit,
                                            comment: response.data[i].comment,
                                            clientId: response.data[i].clientId,
                                            updateSequenceNumber:
                                                response.data[i]
                                                    .updateSequenceNumber,
                                        }).catch((err) => {
                                            console.log(err);
                                        });
                                    }
                                })
                                .catch((err) => {
                                    console.log(err);
                                });
                            // await Order.findAll({
                            //     where: { userId: req.user.id },
                            // })
                            //     .then((orders) => {
                            //         // console.log(orders);
                            //         // res.json(orders);
                            //         console.log("success");
                            //         //res.json({ msg: "success", orders });
                            //     })
                            //     .catch((err) => {
                            //         res.json(err);
                            //     });
                        }
                    });
            } catch (error) {
                res.json({ msg: "error", error });
            }

                        res.json({
                            msg: "login success",
                            user,
                            token: token,
                        });
                    } else {
                        res.status(401).json({
                            msg: "Password did not match",
                        });
                    }
                }
            })
            .catch((err) => {
                console.log(err);
                res.json({ msg: ">> Error while finding data: ", err });
            });
    });

    app.get(
        "/api/users/all",
        [passport.authenticate("admin_auth", { session: false })],
        async (req, res) => {
            await User.findAll({
                include: [
                    {
                        model: MetaTrader,
                        as: "metatrader",
                    },
                ],
                attributes: { exclude: ["password"] },
            })
                .then((result) => {
                    res.json({ data: result });
                })
                .catch((err) => {
                    console.log(err);
                    res.json({ msg: ">> Error while compiling data: ", err });
                });
        }
    );


};
