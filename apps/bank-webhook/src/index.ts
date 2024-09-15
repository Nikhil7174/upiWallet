import express from "express";
import db from "@repo/db/client";
const app = express();
import z from "zod";

const CANARA_SECRET = process.env.CANARA_SECRET || "can@sec";

interface PaymentInformation {
    token: string;
    userId: string;
    amount: number;
    canaraSecret: string;
}

const paymentInformationSchema = z.object({
    token: z.string(),
    userId: z.string(),
    amount: z.number(),
    canaraSecret: z.string()
}); 

app.post("/hdfcWebhook", (req, res) => {
    const paymentInformation: PaymentInformation = {
        token: req.body.token,
        userId: req.body.user_identifier,
        amount: req.body.amount,
        canaraSecret: req.body.canara_secret
    };

    const parsedPaymentInformation = paymentInformationSchema.safeParse(paymentInformation);
    if (!parsedPaymentInformation.success) {
        throw new Error("Invalid input");
      }
    
    if (parsedPaymentInformation.data.canaraSecret !== CANARA_SECRET) {
        res.status(401).json({message : "Not authorized"});
        return;
    }
    // const { userId, amount } = parsedPaymentInformation.data;

    try {
        db.$transaction([
            db.balance.updateMany({
                where: {
                    userId: Number(parsedPaymentInformation.data.userId)
                },
                data: {
                    amount: {
                        increment: parsedPaymentInformation.data.amount
                    }
                }
            }),
            db.onRampTransaction.updateMany({
                where: {
                    userId: Number(parsedPaymentInformation.data.userId)
                },
                data: {
                    status: "Success"
                }
            })
        ])
        res.json({message : "Captured"});
    }
    catch (e) {
        res.status(411).json({message : "Error in webhook"});
    }
})

app.listen(4000, () => {
    console.log("Server is running on port 4000");
})