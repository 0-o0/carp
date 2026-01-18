import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "酒店停车优惠 - 住客专属",
	description: "酒店住客停车优惠申请系统",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-CN">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
				<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
			</head>
			<body className="font-sans antialiased">{children}</body>
		</html>
	);
}
