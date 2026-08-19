import { createWorker } from 'tesseract.js';

export interface ReceiptVerificationResult {
    isValid: boolean;
    confidence: number;
    dateMatched: boolean;
    clabeMatched: boolean;
    holderMatched: boolean;
    amountMatched: boolean;
    detectedDate?: string;
    detectedAmount?: number;
    errorMessage?: string;
    rawText?: string;
}

export interface VerifyReceiptParams {
    imageFile: File | string;
    expectedClabe?: string;
    expectedHolder?: string;
    expectedAmount?: number;
}

/**
 * Smart Receipt Verification Engine (OCR Vision)
 * Validates bank transfer screenshots (BBVA, Banamex, Nu, MercadoPago, STP, Santander, etc.)
 * Checks: 1) TODAY'S Date (prevents old receipt reuse), 2) CLABE digits, 3) Holder Name, 4) Amount.
 */
export async function verifyBankReceipt({
    imageFile,
    expectedClabe = '',
    expectedHolder = '',
    expectedAmount = 0,
}: VerifyReceiptParams): Promise<ReceiptVerificationResult> {
    let worker: any = null;
    try {
        worker = await createWorker('spa');
        const ret = await worker.recognize(imageFile);
        await worker.terminate();

        const rawText = ret.data?.text || '';
        const textUpper = rawText.toUpperCase();

        // 1. DATE CHECK (Mandatory: Must be TODAY or within 24h)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-indexed
        const currentDate = now.getDate();

        const monthNamesEs = [
            'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
            'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
        ];
        const monthFullEs = [
            'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
        ];

        const todayMonthName = monthNamesEs[currentMonth - 1];
        const todayMonthFull = monthFullEs[currentMonth - 1];

        // Search for relative words e.g. "HOY", "TODAY"
        const hasTodayWord = textUpper.includes('HOY') || textUpper.includes('TODAY');

        let dateMatched = hasTodayWord;
        let detectedDateStr = hasTodayWord ? 'Hoy' : undefined;

        if (!dateMatched) {
            // Regex for Mexican date formats: 18/08/2026, 18/08/26, 18 AGO 2026, 18-08-2026
            const dateRegex = /\b(\d{1,2})[\/\.\- ](\d{1,2}|ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)[\/\.\- ]?(\d{2,4})?\b/gi;
            const matches = Array.from(textUpper.matchAll(dateRegex)) as RegExpExecArray[];

            for (const match of matches) {
                const dayStr = match[1];
                const monthStr = match[2];
                const yearStr = match[3];

                const dayNum = parseInt(dayStr, 10);
                let monthNum: number | undefined;

                if (/^\d+$/.test(monthStr)) {
                    monthNum = parseInt(monthStr, 10);
                } else {
                    const idxShort = monthNamesEs.indexOf(monthStr);
                    if (idxShort !== -1) monthNum = idxShort + 1;
                    const idxFull = monthFullEs.indexOf(monthStr);
                    if (idxFull !== -1) monthNum = idxFull + 1;
                }

                // Check if day matches today or yesterday (1-day grace period for timezone/late night transfers)
                if (dayNum && Math.abs(dayNum - currentDate) <= 1) {
                    if (!monthNum || monthNum === currentMonth) {
                        if (!yearStr || parseInt(yearStr.length === 2 ? `20${yearStr}` : yearStr, 10) === currentYear) {
                            dateMatched = true;
                            detectedDateStr = match[0];
                            break;
                        }
                    }
                }
            }
        }

        // Secondary fallback for date check
        if (!dateMatched) {
            const hasDayNum = textUpper.includes(String(currentDate));
            const hasMonth = textUpper.includes(todayMonthName) || textUpper.includes(todayMonthFull) || textUpper.includes(`/${currentMonth}/`) || textUpper.includes(`0${currentMonth}/`);
            if (hasDayNum && hasMonth) {
                dateMatched = true;
                detectedDateStr = `${currentDate} ${todayMonthName}`;
            }
        }

        // 2. CLABE / ACCOUNT CHECK
        let clabeMatched = false;
        const cleanExpectedClabe = expectedClabe.replace(/\D/g, '');

        if (!cleanExpectedClabe) {
            clabeMatched = true; // No CLABE specified
        } else {
            const digitsOnlyText = rawText.replace(/\D/g, '');
            const last4 = cleanExpectedClabe.slice(-4);
            const last8 = cleanExpectedClabe.slice(-8);

            if (digitsOnlyText.includes(cleanExpectedClabe)) {
                clabeMatched = true;
            } else if (last8 && digitsOnlyText.includes(last8)) {
                clabeMatched = true;
            } else if (last4 && (digitsOnlyText.includes(last4) || textUpper.includes(last4))) {
                clabeMatched = true;
            }
        }

        // 3. HOLDER NAME CHECK
        let holderMatched = false;
        if (!expectedHolder || expectedHolder.trim().length === 0) {
            holderMatched = true;
        } else {
            const cleanHolder = expectedHolder.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            const cleanText = textUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const words = cleanHolder.split(/\s+/).filter(w => w.length > 2);
            if (words.length === 0) {
                holderMatched = true;
            } else {
                const matchedWords = words.filter(word => cleanText.includes(word));
                if (matchedWords.length >= Math.ceil(words.length / 2)) {
                    holderMatched = true;
                }
            }
        }

        // 4. STRICT MONETARY AMOUNT CHECK
        let amountMatched = false;
        let detectedAmountVal: number | undefined;

        if (expectedAmount <= 0) {
            amountMatched = true;
        } else {
            // Match numbers explicitly associated with currency symbols ($), MXN/PESOS, or labels (Monto, Importe, Total, Pago, Enviado)
            const strictCurrencyRegex = /(?:(?:\$|\bMONTO|\bIMPORTE|\bTOTAL|\bCANTIDAD|\bENVIADO|\bPAGO)\s*:?\s*\$?\s*([0-9]*\.[0-9]{1,2}|[0-9,]+(?:\.[0-9]{1,2})?)|([0-9]*\.[0-9]{1,2}|[0-9,]+(?:\.[0-9]{1,2})?)\s*(?:MXN|MN|PESOS))/gi;

            const matches = Array.from(rawText.matchAll(strictCurrencyRegex)) as RegExpExecArray[];
            const detectedValues: number[] = [];

            for (const match of matches) {
                let numStr = (match[1] || match[2] || '').replace(/,/g, '');
                if (numStr.startsWith('.')) numStr = `0${numStr}`;
                const val = parseFloat(numStr);
                // Exclude current years e.g. 2024-2030 unless expectedAmount is in that range
                if (!isNaN(val) && val > 0 && !(val >= 2024 && val <= 2030 && expectedAmount < 1000)) {
                    detectedValues.push(val);
                }
            }

            // Fallback: If no explicit $ / MXN symbol was detected, scan isolated numbers ignoring years, times, and long CLABEs
            if (detectedValues.length === 0) {
                const fallbackNumberRegex = /\b([0-9]{1,6}(?:\.[0-9]{1,2})?)\b/g;
                const fallbackMatches = Array.from(rawText.matchAll(fallbackNumberRegex)) as RegExpExecArray[];
                for (const match of fallbackMatches) {
                    const numStr = match[1];
                    const val = parseFloat(numStr);
                    if (!isNaN(val) && val > 0 && !(val >= 2024 && val <= 2030 && expectedAmount < 1000) && numStr.length < 10) {
                        detectedValues.push(val);
                    }
                }
            }

            if (detectedValues.length > 0) {
                // Find if any detected value satisfies the required deposit amount
                const validMatch = detectedValues.find(val => val >= expectedAmount - 0.05);

                if (validMatch !== undefined) {
                    amountMatched = true;
                    detectedAmountVal = validMatch;
                } else {
                    // Store the closest detected transfer value (e.g. 0.74) for the error message
                    detectedAmountVal = detectedValues.sort((a, b) => a - b)[0];
                    amountMatched = false;
                }
            } else {
                amountMatched = false;
            }
        }

        const isValid = dateMatched && clabeMatched && holderMatched && amountMatched;

        let errorMessage = '';
        if (!dateMatched) {
            errorMessage = `⚠️ El comprobante no parece ser del día de hoy (${currentDate} ${todayMonthName}). Por favor sube una captura de tu transferencia realizada hoy.`;
        } else if (!clabeMatched) {
            errorMessage = `⚠️ No se detectó la CLABE o cuenta (${expectedClabe.slice(-4)}) en la imagen. Asegúrate de que los datos de la transferencia sean legibles.`;
        } else if (!holderMatched) {
            errorMessage = `⚠️ No se detectó el titular (${expectedHolder}) en la captura. Por favor sube la imagen completa del comprobante.`;
        } else if (!amountMatched) {
            const detectedStr = detectedAmountVal !== undefined ? `$${detectedAmountVal.toFixed(2)} MXN` : 'incompleto';
            errorMessage = `⚠️ Se detectó una transferencia de ${detectedStr}, pero el anticipo requerido es de $${expectedAmount.toFixed(2)} MXN.`;
        }

        return {
            isValid,
            confidence: Math.round(ret.data?.confidence || 90),
            dateMatched,
            clabeMatched,
            holderMatched,
            amountMatched,
            detectedDate: detectedDateStr,
            detectedAmount: detectedAmountVal,
            errorMessage: isValid ? undefined : errorMessage,
            rawText,
        };
    } catch (err: any) {
        if (worker) {
            try { await worker.terminate(); } catch {}
        }
        console.warn('OCR processing error:', err);
        return {
            isValid: false,
            confidence: 0,
            dateMatched: false,
            clabeMatched: false,
            holderMatched: false,
            amountMatched: false,
            errorMessage: '⚠️ No se pudo escanear la imagen. Por favor sube una captura clara y nítida de tu comprobante.',
        };
    }
}
