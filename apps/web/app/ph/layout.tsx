import "../globals.css";

export default function PHLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh">
			<body className="bg-background text-foreground antialiased overflow-hidden">
				{children}
			</body>
		</html>
	);
}
