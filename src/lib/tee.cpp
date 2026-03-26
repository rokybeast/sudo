#include <iostream>
#include <fstream>
#include <string>

int main() {
    std::ofstream log(".bot.log", std::ios::app);
    std::string line;
    while (std::getline(std::cin, line)) {
        std::cout << line << std::endl;
        if (log.is_open()) {
            log << line << std::endl;
        }
    }
    return 0;
}
