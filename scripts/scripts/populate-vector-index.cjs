"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try {
            step(generator.next(value));
        }
        catch (e) {
            reject(e);
        } }
        function rejected(value) { try {
            step(generator["throw"](value));
        }
        catch (e) {
            reject(e);
        } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1)
            throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f)
            throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _)
            try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                    return t;
                if (y = 0, t)
                    op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0:
                    case 1:
                        t = op;
                        break;
                    case 4:
                        _.label++;
                        return { value: op[1], done: false };
                    case 5:
                        _.label++;
                        y = op[1];
                        op = [0];
                        continue;
                    case 7:
                        op = _.ops.pop();
                        _.trys.pop();
                        continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                            _ = 0;
                            continue;
                        }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                            _.label = op[1];
                            break;
                        }
                        if (op[0] === 6 && _.label < t[1]) {
                            _.label = t[1];
                            t = op;
                            break;
                        }
                        if (t && _.label < t[2]) {
                            _.label = t[2];
                            _.ops.push(op);
                            break;
                        }
                        if (t[2])
                            _.ops.pop();
                        _.trys.pop();
                        continue;
                }
                op = body.call(thisArg, _);
            }
            catch (e) {
                op = [6, e];
                y = 0;
            }
            finally {
                f = t = 0;
            }
        if (op[0] & 5)
            throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleProducts = exports.vectorIndex = exports.logger = void 0;
exports.populateVectorIndex = populateVectorIndex;
// scripts/populate-vector-index.ts
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)(); // Load .env variables
var vector_1 = require("@upstash/vector");
var pino_1 = require("pino");
exports.logger = (0, pino_1.default)({ level: 'info' });
exports.vectorIndex = new vector_1.Index({
    url: process.env.UPSTASH_VECTOR_REST_URL || '',
    token: process.env.UPSTASH_VECTOR_REST_TOKEN || '',
});
// Sample products to match simulate-chat.ts test cases
exports.sampleProducts = [
    {
        id: 'prod_001',
        variantId: 'var_001',
        title: 'Hydrating Serum',
        price: 45.99,
        productUrl: 'https://shop.planetbeauty.com/products/hydrating-serum',
        imageUrl: 'https://shop.planetbeauty.com/images/hydrating-serum.jpg',
        textForBM25: 'Hydrating serum for dry skin, infused with hyaluronic acid, vegan, cruelty-free.',
        tags: ['serum', 'dry skin', 'vegan', 'cruelty-free', 'hyaluronic acid'],
    },
    {
        id: 'prod_002',
        variantId: 'var_002',
        title: 'Vegan Lipstick',
        price: 22.50,
        productUrl: 'https://shop.planetbeauty.com/products/vegan-lipstick',
        imageUrl: 'https://shop.planetbeauty.com/images/vegan-lipstick.jpg',
        textForBM25: 'Vegan lipstick, cruelty-free, long-lasting color for all skin tones.',
        tags: ['lipstick', 'vegan', 'cruelty-free'],
    },
    {
        id: 'prod_003',
        variantId: 'var_003',
        title: 'SPF 50 Sunscreen',
        price: 29.99,
        productUrl: 'https://shop.planetbeauty.com/products/spf-50-sunscreen',
        imageUrl: 'https://shop.planetbeauty.com/images/spf-50-sunscreen.jpg',
        textForBM25: 'SPF 50 sunscreen, broad-spectrum protection, suitable for dry skin.',
        tags: ['sunscreen', 'dry skin', 'spf 50'],
    },
    {
        id: 'prod_004',
        variantId: 'var_004',
        title: 'Brightening Eye Cream',
        price: 35.00,
        productUrl: 'https://shop.planetbeauty.com/products/brightening-eye-cream',
        imageUrl: 'https://shop.planetbeauty.com/images/brightening-eye-cream.jpg',
        textForBM25: 'Eye cream for dark circles, with vitamin C, vegan, cruelty-free.',
        tags: ['eye cream', 'dark circles', 'vegan', 'cruelty-free', 'vitamin c'],
    },
    {
        id: 'prod_005',
        variantId: 'var_005',
        title: 'Gentle Cleanser',
        price: 19.99,
        productUrl: 'https://shop.planetbeauty.com/products/gentle-cleanser',
        imageUrl: 'https://shop.planetbeauty.com/images/gentle-cleanser.jpg',
        textForBM25: 'Gentle cleanser for oily skin, non-comedogenic, vegan.',
        tags: ['cleanser', 'oily skin', 'vegan'],
    },
    {
        id: 'prod_006',
        variantId: 'var_006',
        title: 'Hydrating Moisturizer',
        price: 25.00,
        productUrl: 'https://shop.planetbeauty.com/products/hydrating-moisturizer',
        imageUrl: 'https://shop.planetbeauty.com/images/hydrating-moisturizer.jpg',
        textForBM25: 'Hydrating moisturizer for dry skin, with aloe vera, cruelty-free.',
        tags: ['moisturizer', 'dry skin', 'cruelty-free', 'aloe vera'],
    },
    {
        id: 'prod_007',
        variantId: 'var_007',
        title: 'Balancing Toner',
        price: 18.50,
        productUrl: 'https://shop.planetbeauty.com/products/balancing-toner',
        imageUrl: 'https://shop.planetbeauty.com/images/balancing-toner.jpg',
        textForBM25: 'Balancing toner for oily skin, with witch hazel, vegan.',
        tags: ['toner', 'oily skin', 'vegan', 'witch hazel'],
    },
    {
        id: 'prod_008',
        variantId: 'var_008',
        title: 'Dry Skin Skincare Set',
        price: 89.99,
        productUrl: 'https://shop.planetbeauty.com/products/dry-skin-skincare-set',
        imageUrl: 'https://shop.planetbeauty.com/images/dry-skin-skincare-set.jpg',
        textForBM25: 'Skincare set for dry skin, includes cleanser, serum, moisturizer, vegan, cruelty-free.',
        tags: ['set', 'dry skin', 'cleanser', 'serum', 'moisturizer', 'vegan', 'cruelty-free'],
    },
    {
        id: 'prod_009',
        variantId: 'var_009',
        title: 'Caudalie Vinoperfect Dark Circle Brightening Eye Cream with Niacinamide',
        price: 55.00,
        productUrl: 'https://shop.planetbeauty.com/products/caudalie-vinoperfect-eye-cream',
        imageUrl: 'https://shop.planetbeauty.com/images/caudalie-vinoperfect-eye-cream.jpg',
        textForBM25: 'Eye cream for dark circles, with niacinamide, vegan, cruelty-free.',
        tags: ['eye cream', 'dark circles', 'vegan', 'cruelty-free', 'niacinamide'],
    },
    {
        id: 'prod_010',
        variantId: 'var_010',
        title: 'COOLA Suncare Classic Body Organic Sunscreen Lotion SPF 50 - Guava',
        price: 28.00,
        productUrl: 'https://shop.planetbeauty.com/products/coola-sunscreen-spf50',
        imageUrl: 'https://shop.planetbeauty.com/images/coola-sunscreen-spf50.jpg',
        textForBM25: 'Sunscreen SPF 50, organic, suitable for all skin types, cruelty-free.',
        tags: ['sunscreen', 'spf 50', 'cruelty-free'],
    },
];
function populateVectorIndex() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, sampleProducts_1, product, upsertId, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    exports.logger.info('Starting vector index population...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    // Clear existing index
                    return [4 /*yield*/, exports.vectorIndex.reset()];
                case 2:
                    // Clear existing index
                    _a.sent();
                    exports.logger.info('Cleared existing vector index.');
                    _i = 0, sampleProducts_1 = exports.sampleProducts;
                    _a.label = 3;
                case 3:
                    if (!(_i < sampleProducts_1.length))
                        return [3 /*break*/, 6];
                    product = sampleProducts_1[_i];
                    upsertId = product.variantId || product.id || "fallback_".concat(product.title.replace(/\s+/g, '_'));
                    return [4 /*yield*/, exports.vectorIndex.upsert({
                            id: upsertId,
                            data: "".concat(product.title, " ").concat(product.textForBM25),
                            metadata: product,
                        })];
                case 4:
                    _a.sent();
                    exports.logger.info({ productId: product.id, title: product.title, upsertId: upsertId }, 'Upserted product to vector index.');
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    exports.logger.info({ count: exports.sampleProducts.length }, 'Successfully populated vector index.');
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _a.sent();
                    exports.logger.error({ error: error_1 }, 'Failed to populate vector index.');
                    throw error_1;
                case 8: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, populateVectorIndex()];
                case 1:
                    _a.sent();
                    console.log('Vector index population completed.');
                    process.exit(0);
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error('Vector index population failed:', error_2);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
main();
