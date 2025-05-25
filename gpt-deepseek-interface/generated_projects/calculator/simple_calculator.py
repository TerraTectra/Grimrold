# Description: A simple calculator with add, subtract, multiply, and divide operations.

import os

def clear_screen():
    """Clears the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def get_number(prompt):
    """Prompts user for a number and returns it as an integer or float."""
    while True:
        try:
            num = float(input(prompt))
            return num
        except ValueError:
            print("Please enter a valid number.")

def add(a, b):
    """Returns the sum of two numbers."""
    return a + b

def subtract(a, b):
    """Returns the difference between two numbers."""
    return a - b

def multiply(a, b):
    """Returns the product of two numbers."""
    return a * b

def divide(a, b):
    """Returns the quotient of two numbers. Handles division by zero."""
    if b == 0:
        raise ValueError("Cannot divide by zero.")
    return a / b

def main_menu():
    """Displays the main menu and handles user input."""
    while True:
        clear_screen()
        print("Simple Calculator")
        print("1. Add")
        print("2. Subtract")
        print("3. Multiply")
        print("4. Divide")
        print("5. Exit")
        choice = input("Enter your choice (1-5): ")
        
        if choice == '5':
            clear_screen()
            break
        elif choice in ['1', '2', '3', '4']:
            num1 = get_number("Enter the first number: ")
            num2 = get_number("Enter the second number: ")
            
            if choice == '1':
                result = add(num1, num2)
                print(f"The sum is: {result}")
            elif choice == '2':
                result = subtract(num1, num2)
                print(f"The difference is: {result}")
            elif choice == '3':
                result = multiply(num1, num2)
                print(f"The product is: {result}")
            elif choice == '4':
                try:
                    result = divide(num1, num2)
                    print(f"The quotient is: {result}")
                except ValueError as e:
                    print(e)
            input("Press Enter to continue...")
        else:
            print("Invalid choice. Please enter a number between 1 and 5.")
            input("Press Enter to continue...")

if __name__ == "__main__":
    main_menu()