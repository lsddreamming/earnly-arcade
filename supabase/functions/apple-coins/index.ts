import {appleCommerceHandler} from '../_shared/apple-commerce.ts';
import {appleOptions} from '../_shared/apple-review-runtime.ts';
Deno.serve(appleCommerceHandler(appleOptions));
