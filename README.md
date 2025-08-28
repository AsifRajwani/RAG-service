# Requirements

This project requires **Node.js version 22.15.x or above** (download from https://nodejs.org/).

# How to Run and Test the MCP Server

## Setup and Installation

1.  **Clone the repository:** Clone the GitHub repository to your local machine using the command:

    ```bash
    git clone https://github.com/AsifRajwani/RAG-service.git
    ```

2.  **Navigate to the directory:** Change your current directory to the project folder:

    ```bash
    cd RAG
    ```

3.  **Install dependencies:** Install all the required packages by running:

    ```bash
    npm install
    ```

    This command will create a `node_modules` directory in your project.

---

## Compiling and Running the Server

1.  **Compile the code:** Build the project by running the following command and ensure there are no errors:

    ```bash
    npm run build
    ```

2.  **Start the server:** Run the server with this command.

    ```bash
    npm run start
    ```

---

## Testing with the Inspector

Test various webserivces calls using **CURL**

**Ingest documents and build index.**

```bash
    curl -X POST http://localhost:4100/ingest -H "content-type: application/json" -d '{}'
```

**Search for word example and return top 3 results.**

```bash
    url "http://localhost:4100/search?query=example&k=3"
```

**Search for the 'UltraBook Pro 15 warranty" and return top 3 results.**

```bash.
    curl "http://localhost:4100/search?query=UltraBook%20Pro%2015%20warranty&k=3"
```

## Data

All the document used are in directory **kb**
