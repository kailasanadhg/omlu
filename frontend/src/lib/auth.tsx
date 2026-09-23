"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/types";
import { apiRequest } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<User>;
  signup: (email: string, username: string, displayName: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserContext: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const savedToken = typeof window !== "undefined" ? localStorage.getItem("omlu_token") : null;
      if (!savedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        const fetchedUser = await apiRequest<User>("/auth/me", { token: savedToken });
        if (isMounted) {
          setToken(savedToken);
          setUser(fetchedUser);
        }
      } catch {
        if (typeof window !== "undefined") {
          localStorage.removeItem("omlu_token");
        }
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (emailOrUsername: string, password: string): Promise<User> => {
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email_or_username: emailOrUsername, password }),
    });
    localStorage.setItem("omlu_token", res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const signup = async (
    email: string,
    username: string,
    displayName: string,
    password: string
  ): Promise<User> => {
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        username,
        display_name: displayName,
        password,
      }),
    });
    localStorage.setItem("omlu_token", res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem("omlu_token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const refreshed = await apiRequest<User>("/auth/me");
      setUser(refreshed);
    } catch {
      // Ignore
    }
  };

  const updateUserContext = (updatedFields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
        updateUserContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
