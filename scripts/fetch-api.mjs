import fetch from 'node-fetch';

async function main() {
    try {
        const res = await fetch('http://localhost:3000/api/products?page=1&limit=20');
        console.log(res.status);
        console.log(await res.text());
    } catch (e) {
        console.error(e.message);
    }
}
main();
