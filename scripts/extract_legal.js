const mammoth = require("mammoth");
const fs = require("fs");

async function extract() {
    try {
        const terms = await mammoth.extractRawText({ path: "Clivaro_Terminos_y_Condiciones.docx" });
        const privacy = await mammoth.extractRawText({ path: "Clivaro_Politica_Datos_Personales.docx" });

        fs.writeFileSync("terms_content.txt", terms.value);
        fs.writeFileSync("privacy_content.txt", privacy.value);
        console.log("Extraction complete");
    } catch (e) {
        console.error(e);
    }
}

extract();
