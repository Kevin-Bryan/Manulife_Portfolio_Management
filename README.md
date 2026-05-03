# Manulife Portfolio Management

A full-stack portfolio management application built with **Next.js**, **FastAPI**, and **PostgreSQL**.

## Tech Stack

- **Frontend:** Next.js
- **Backend:** FastAPI
- **Database:** PostgreSQL

## How to Run

1. Clone the repository
2. `cd Manulife_Portfilio_Management`
3. In the `frontend`, `backend`, and `docker` folders, create a `.env` file from `.env.example`
4. From the root directory, run:

```bash
docker compose build --no-cache
docker compose up
```

## Important Demo Notes

> **Demo Account**
>
> An account is automatically created for testing:
>
> - **Username:** `demo`
> - **Password:** `password123`

> **Seeded Dummy Data**
>
> Dummy portfolio data is automatically loaded when the application starts for the first time.

> **JWT Expiry**
>
> The JWT token is valid for **7 minutes**.  
> After it expires, you will be redirected to log in again to obtain a new token.

## Sequence Diagram

![Sequence Diagram](docs/sequence-diagram.jpeg)
