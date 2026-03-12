const { Parser } = require('node-sql-parser');

const validateDuckDBSQL = (sqlString) => {
    const parser = new Parser();
    let ast;
    try {

        ast = parser.astify(sqlString);
    } catch (err) {
        throw new Error(`Failed to parse SQL: ${err.message}`);
    }

    const statements = Array.isArray(ast) ? ast : [ast];

    for (const stmt of statements) {
        if (!stmt.type || stmt.type.toLowerCase() !== 'select') {
            throw new Error(`Execution blocked: Only SELECT statements are permitted. Found type: ${stmt.type}`);
        }
    }

    return true;
};

module.exports = {
    validateDuckDBSQL
};