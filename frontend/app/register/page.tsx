"use client";

import axios from "axios";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!username.trim() || !password.trim()) {
			setMessage("Username and password cannot be empty.");
			return;
		}

		setLoading(true);
		setMessage("");

		try {
			await axios.post(
				`${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
				{
					username,
					password,
				}
			);

			router.push("/login");
		} catch (error) {
			if (axios.isAxiosError(error)) {
				setMessage(error.response?.data?.detail ?? "Something went wrong. Please try again.");
			} else {
				setMessage("Something went wrong. Please try again.");
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen flex items-center justify-center px-4 py-12">
			<div className="w-full max-w-sm rounded-2xl border-2 border-neutral-300 bg-white p-8 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
				<div className="mb-6 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">Register</h1>
				</div>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label htmlFor="username" className="block text-sm font-medium">
							Username
						</label>
						<input
							id="username"
							name="username"
							type="text"
							autoComplete="username"
							placeholder="Your username"
							value={username}
							onChange={(event) => setUsername(event.target.value)}
							className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="password" className="block text-sm font-medium">
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							placeholder="Your password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 dark:focus:ring-white dark:focus:ring-offset-neutral-950"
					>
						{loading ? "Registering..." : "Register"}
					</button>

					{message ? (
						<div className="text-sm text-red-500 dark:text-red-400">{message}</div>
					) : null}
				</form>


			</div>
		</main>
	);
}