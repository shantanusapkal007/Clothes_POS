"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { useStoreName } from "../lib/store-settings";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const storeName = useStoreName();

  if (pathname === "/login") {
    return null;
  }

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const navItems = [
    { name: "Sales", href: "/" as const, icon: "payments" },
    { name: "Stock", href: "/inventory" as const, icon: "inventory_2" }
  ];

  return (
    <>
      {/* ─── Top Header ─── */}
      <header className="fixed left-0 top-0 z-50 flex h-14 w-full items-center justify-between border-b border-outline-variant/50 bg-white/90 px-3 shadow-sm backdrop-blur-md sm:h-16 sm:px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3 md:gap-12">
          <h1 className="truncate text-base font-serif tracking-tight text-primary sm:text-xl md:text-2xl">
            {storeName}
          </h1>
          <nav className="hidden md:flex items-center gap-8 h-16">
            <Link 
              href="/" 
              className={`font-semibold h-full flex items-center px-2 transition-colors duration-300 ${
                pathname === "/" ? "text-primary border-b-2 border-primary" : "text-on-secondary-container hover:text-primary"
              }`}
            >
              POS
            </Link>
            <Link 
              href="/inventory" 
              className={`font-medium h-full flex items-center px-2 transition-colors duration-300 ${
                pathname === "/inventory" ? "text-primary border-b-2 border-primary" : "text-on-secondary-container hover:text-primary"
              }`}
            >
              Inventory
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
          <button className="hidden sm:inline-flex material-symbols-outlined p-2 text-on-secondary-container hover:text-primary transition-colors cursor-pointer active:opacity-70">
            notifications
          </button>
          <button className="hidden sm:inline-flex material-symbols-outlined p-2 text-on-secondary-container hover:text-primary transition-colors cursor-pointer active:opacity-70">
            settings
          </button>
          <button
            className="hidden sm:inline-flex material-symbols-outlined p-2 text-on-secondary-container hover:text-primary transition-colors cursor-pointer active:opacity-70"
            onClick={handleSignOut}
            title="Sign out"
            type="button"
          >
            logout
          </button>
          <div className="ml-1 hidden h-8 w-8 cursor-pointer overflow-hidden rounded-lg ring-2 ring-primary-fixed sm:block">
            <img
              alt="Manager Profile"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1Dkd6HkJ0s18H_Aod9frXDryOaLvEzlHK4e7Xo2sXhWglcvhuAjUgYTCzZmeu_KOR3Ur9AOqM6Mg6oNR3-YkRgC1_LxPzHa57E1nOvVx4Xcj_8r7zGHDtY-y4mPj87ZwJVQbknqKJadv4dYfpmyEa6Sdw95BAz7WQfycMzshLP8dm9BlEkXFF9SagKgdoj-EtfCVT9RbHOevLF5RXXP0GNCuz5dmZ8g68AskiDwrSAqHuXP2w7qP7DmI9SUzzWcCiaW9b53Q_jog"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* ─── Desktop Sidebar ─── */}
      <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] py-8 flex-col gap-2 w-64 bg-white/90 shadow-[20px_0_40px_rgba(8,47,40,0.05)] z-40 hidden md:flex border-r border-outline-variant/40 backdrop-blur-md">
        <div className="px-8 mb-8">
          <h4 className="text-lg font-serif italic text-primary">Back Office</h4>
          <p className="font-sans text-xs tracking-wide text-on-secondary-container uppercase font-bold opacity-70">Management Suite</p>
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name}
                href={item.href} 
                className={`rounded-lg mx-4 py-3 px-6 flex items-center gap-3 transition-all cursor-pointer hover:translate-x-1 duration-200 active:scale-95 ${
                  isActive 
                    ? "bg-primary-fixed text-primary font-bold shadow-sm" 
                    : "text-on-secondary-container hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-sans text-sm tracking-wide">{item.name}</span>
              </Link>
            );
          })}
          
          {/* Inactive placeholders */}
          <div className="text-on-secondary-container opacity-50 rounded-lg mx-4 py-3 px-6 flex items-center gap-3 transition-all cursor-not-allowed">
            <span className="material-symbols-outlined">shopping_bag</span>
            <span className="font-sans text-sm tracking-wide">Orders</span>
          </div>
          <div className="text-on-secondary-container opacity-50 rounded-lg mx-4 py-3 px-6 flex items-center gap-3 transition-all cursor-not-allowed">
            <span className="material-symbols-outlined">group</span>
            <span className="font-sans text-sm tracking-wide">Staff</span>
          </div>
        </nav>
        <div className="px-8 py-4 mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low p-1">
              <img
                alt={`${storeName} logo`}
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDD9UG5Ct8w_kKziztfse4IyC1DLiguLbWyp9UjS_mq9n_YeSdgCQ4MFoJ0fyXK9G4-kh-mx5gbiMV4Ve1vOv93N4jWM3Kur_Rr7WF8OZok2gMkQgXdbjCHnxiHNbuPc74EEltnGLNQk3NhsMcqzqZkExsA8XEzvyW5h8mPouvA5epdwInq9D5tKTtjPBUtl6S5irh4mQFSLIbCZnWJLkZN6vwPmG049ZD7jp1LZ7iUqmaeCHmWT0yqKI14H0CRUNz8dwRBzv3_KbE"
                className="w-full h-full object-cover rounded-md"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-primary">v2.5.0</p>
              <p className="text-[10px] text-on-secondary-container">Mobile-ready POS</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Bottom Tab Bar ─── */}
      <nav className="bottom-tab-bar" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`bottom-tab ${isActive ? "bottom-tab--active" : "bottom-tab--inactive"}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
