#include <iostream>
#include <cstdio>
#include <array>
#include <string>

int main(int argc, char* argv[]) {
    if (argc < 3) {
        std::cerr << "Usage: exec <cwd> <command>" << std::endl;
        return 1;
    }

    std::string cwd = argv[1];
    std::string cmd = "";
    for (int i = 2; i < argc; i++) {
        if (i > 2) cmd += " ";
        cmd += argv[i];
    }

    std::string fullCmd = "cd " + cwd + " && " + cmd + " 2>&1";

    FILE* pipe = popen(fullCmd.c_str(), "r");
    if (!pipe) {
        std::cerr << "popen() failed" << std::endl;
        return 127;
    }

    std::array<char, 4096> buffer;
    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
        std::cout << buffer.data();
    }

    int status = pclose(pipe);
    int exitCode = WEXITSTATUS(status);

    return exitCode;
}
