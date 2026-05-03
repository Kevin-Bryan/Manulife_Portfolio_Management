"use client";

import axios from "axios";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
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
			const formData = new URLSearchParams();
			formData.append("username", username);
			formData.append("password", password);

			const response = await axios.post(
				`${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
				formData,
				{ headers: { "Content-Type": "application/x-www-form-urlencoded" } }
			);

			const token = response.data.access_token;
			localStorage.setItem("token", token);
			setMessage(response.data?.message ?? "Login successful.");
            router.push("/dashboard");
		} catch (error) {
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 401) {
					setMessage(error.response?.data?.detail ?? "Invalid username or password.");
				} else {
					setMessage(error.response?.data?.detail ?? "Something went wrong. Please try again.");
				}
			} else {
				setMessage("Something went wrong. Please try again.");
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen flex items-center justify-center px-4 py-12">
			<div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-950">
				<div className="mb-6 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">Login</h1>
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
						{loading ? "Signing in..." : "Sign in"}
					</button>

					{message ? (
						<div className="text-sm text-red-500 dark:text-red-400">{message}</div>
					) : null}
				</form>

				<p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
					Don&apos;t have an account?{" "}
					<Link
						href="/register"
						className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-white"
					>
						Register
					</Link>
				</p>
			</div>
		</main>
	);
}